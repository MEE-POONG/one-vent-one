import { createConnection } from "node:net";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";

export const localDatabaseUrl =
  "mongodb://127.0.0.1:27018/oneventone?replicaSet=rs0&directConnection=true";

export function usesLocalDatabase(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "mongodb:" &&
      ["127.0.0.1", "localhost"].includes(parsed.hostname) &&
      parsed.port === "27018" &&
      parsed.searchParams.get("replicaSet") === "rs0"
    );
  } catch {
    // Multi-host MongoDB URIs need not be parseable as a single-host URL.
    return false;
  }
}

function portInUse(port: number) {
  return new Promise<boolean>((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`ตรวจสอบพอร์ต ${port} ไม่สำเร็จ`));
    });
    socket.once("error", (error: NodeJS.ErrnoException) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(new Error(`ตรวจสอบพอร์ต ${port} ไม่สำเร็จ`));
    });
  });
}

export async function startLocalDatabase({
  port = 27018,
  dbPath = path.resolve(".local/mongodb"),
  databaseUrl = localDatabaseUrl,
}: { port?: number; dbPath?: string; databaseUrl?: string } = {}) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local development database cannot run in production.");

  if (await portInUse(port)) {
    const url = new URL(databaseUrl);
    url.searchParams.set("serverSelectionTimeoutMS", "3000");
    url.searchParams.set("connectTimeoutMS", "3000");
    const client = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    try {
      const hello = await client.$runCommandRaw({ hello: 1 });
      if (hello.setName !== "rs0" || hello.isWritablePrimary !== true)
        throw new Error("Replica set not ready");
    } catch {
      throw new Error(
        `พอร์ต ${port} ถูกใช้งาน แต่เชื่อมต่อ MongoDB replica set rs0 ไม่สำเร็จ กรุณาตรวจสอบฐานข้อมูลหรือโปรแกรมที่ใช้พอร์ตนี้`,
      );
    } finally {
      await client.$disconnect();
    }
    console.log(
      `[db] ใช้ MongoDB ที่เปิดอยู่แล้วบนพอร์ต ${port} (จะไม่ปิดฐานข้อมูลตัวเดิมเมื่อหยุดเว็บ)`,
    );
    return { owned: false, stop: async () => {} };
  }

  await mkdir(dbPath, { recursive: true });
  const replica = new MongoMemoryReplSet({
    binary: { version: "8.0.17" },
    replSet: {
      name: "rs0",
      count: 1,
      storageEngine: "wiredTiger",
      ip: "127.0.0.1",
    },
  });
  // A persistent replica member must keep its saved port on every restart.
  // Supplying the member explicitly also bypasses the library's cached port allocator.
  replica.servers.push(
    new MongoMemoryServer({
      binary: { version: "8.0.17" },
      instance: {
        port,
        dbPath,
        replSet: "rs0",
        ip: "127.0.0.1",
        storageEngine: "wiredTiger",
        portGeneration: false,
      },
    }),
  );
  try {
    await replica.start();
    // Never let automatic port selection silently start the wrong database.
    if (new URL(replica.getUri()).port !== String(port))
      throw new Error(`พอร์ต ${port} ถูกใช้ระหว่างเปิดฐานข้อมูล กรุณาลองใหม่`);
  } catch (error) {
    await replica.stop({ doCleanup: false });
    throw error;
  }
  console.log(
    `[db] MongoDB พร้อมที่ 127.0.0.1:${port} (replica set rs0) เก็บข้อมูลถาวรใน ${dbPath}`,
  );
  return {
    owned: true,
    stop: async () => {
      await replica.stop({ doCleanup: false });
    },
  };
}
