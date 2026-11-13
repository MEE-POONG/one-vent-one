import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { once } from "node:events";
import { fork } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  localDatabaseUrl,
  startLocalDatabase,
  usesLocalDatabase,
} from "../scripts/local-database";

async function tempDirectory() {
  const root = path.resolve(tmpdir());
  return mkdtemp(path.join(root, "oneventone-dev-"));
}

async function removeTemporaryDirectory(directory: string) {
  assert.equal(path.dirname(directory), path.resolve(tmpdir()));
  assert.ok(path.basename(directory).startsWith("oneventone-dev-"));
  await rm(directory, { recursive: true, force: true });
}

test(
  "dev database: reuse leaves the original running; owned restarts preserve data",
  { timeout: 60000 },
  async (t) => {
    assert.equal(usesLocalDatabase(localDatabaseUrl), true);
    assert.equal(
      usesLocalDatabase(localDatabaseUrl.replace("127.0.0.1", "localhost")),
      true,
    );
    for (const url of [
      "mongodb+srv://example.invalid/app",
      "mongodb://127.0.0.1:27017/app",
      "mongodb://db1:27017,db2:27017/app?replicaSet=rs0",
    ])
      assert.equal(usesLocalDatabase(url), false);

    const directory = await tempDirectory();
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = (probe.address() as { port: number }).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    const databaseUrl = `mongodb://127.0.0.1:${port}/dev_lifecycle?replicaSet=rs0&directConnection=true`;
    const options = { port, dbPath: directory, databaseUrl };
    let database: Awaited<ReturnType<typeof startLocalDatabase>> | undefined;
    const client = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    t.after(async () => {
      await client.$disconnect();
      await database?.stop();
      await removeTemporaryDirectory(directory);
    });
    database = await startLocalDatabase(options);
    assert.equal(database.owned, true);
    await client.$runCommandRaw({
      insert: "DevLifecycleProbe",
      documents: [{ _id: "persist", value: 42 }],
    });
    const shared = await startLocalDatabase(options);
    assert.equal(shared.owned, false);
    await shared.stop();
    assert.equal((await client.$runCommandRaw({ ping: 1 })).ok, 1);
    await client.$disconnect();
    await database.stop();
    database = await startLocalDatabase(options);
    const found = await client.$runCommandRaw({
      find: "DevLifecycleProbe",
      filter: { _id: "persist" },
    });
    assert.deepEqual((found.cursor as { firstBatch: unknown[] }).firstBatch, [
      { _id: "persist", value: 42 },
    ]);
  },
);

test(
  "dev database rejects an occupied port that is not MongoDB",
  { timeout: 15000 },
  async (t) => {
    const server = createServer((socket) => socket.destroy());
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(
      () => new Promise<void>((resolve) => server.close(() => resolve())),
    );
    const port = (server.address() as { port: number }).port;
    await assert.rejects(
      startLocalDatabase({
        port,
        databaseUrl: `mongodb://127.0.0.1:${port}/test?replicaSet=rs0&directConnection=true`,
      }),
      /พอร์ต.*ถูกใช้งาน/,
    );
  },
);

test(
  "dev launcher forwards arguments, stops the owned web tree, and propagates failures",
  { timeout: 30000 },
  async (t) => {
    const directory = await tempDirectory();
    const bin = path.join(directory, "node_modules/next/dist/bin");
    await mkdir(bin, { recursive: true });
    // A real CLI/worker process tree exercises Windows cleanup without starting a second app.
    await writeFile(
      path.join(bin, "next"),
      `
    const { spawn } = require('node:child_process');
    if (process.argv.includes('--fail')) process.exit(7);
    console.log('ARGS:' + JSON.stringify(process.argv.slice(2)));
    spawn(process.execPath, ['-e', "const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>console.log('WORKER:'+process.pid));"], { stdio: 'inherit', windowsHide: true });
  `,
    );
    const launch = (args: string[]) =>
      fork(path.resolve("scripts/dev.ts"), args, {
        cwd: directory,
        execArgv: [
          "--import",
          pathToFileURL(path.resolve("node_modules/tsx/dist/loader.mjs")).href,
        ],
        env: {
          ...process.env,
          DATABASE_URL: "mongodb://external.invalid:27017/app",
          NODE_ENV: "development",
        },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        windowsHide: true,
      });
    const child = launch(["--port", "3109"]);
    let output = "";
    const ready = new Promise<number>((resolve) =>
      child.stdout!.on("data", (chunk) => {
        output += String(chunk);
        const match = output.match(/WORKER:(\d+)/);
        if (match) resolve(Number(match[1]));
      }),
    );
    const closed = once(child, "exit");
    t.after(async () => {
      if (child.connected) child.disconnect();
      await closed;
      await removeTemporaryDirectory(directory);
    });
    const workerPid = await ready;
    assert.match(output, /"--port","3109"/);
    assert.ok(!output.includes("external.invalid"));
    child.disconnect();
    assert.equal((await closed)[0], 0);
    assert.throws(() => process.kill(workerPid, 0));
    const failing = launch(["--fail"]);
    const failed = once(failing, "exit");
    failing.stdout!.resume();
    failing.stderr!.resume();
    assert.equal((await failed)[0], 7);
  },
);
