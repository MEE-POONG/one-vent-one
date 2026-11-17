import "dotenv/config";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { startLocalDatabase, usesLocalDatabase } from "./local-database";

const exec = promisify(execFile);
let web: ChildProcess | undefined;
let database: ReturnType<typeof startLocalDatabase> | undefined;
let stopping = false;
let shutdown: Promise<void> | undefined;

function stop(exitCode: number) {
  if (shutdown) return shutdown;
  stopping = true;
  shutdown = (async () => {
    console.log("\n[dev] กำลังหยุดเว็บและฐานข้อมูลที่เปิดจากคำสั่งนี้…");
    try {
      if (web?.pid && web.exitCode === null && web.signalCode === null) {
        // Next's CLI owns a worker process. Stop the whole owned tree on Windows.
        if (process.platform === "win32") {
          await exec("taskkill.exe", ["/PID", String(web.pid), "/T", "/F"], {
            windowsHide: true,
          }).catch(() => {});
        } else {
          const group = web.pid;
          const force = setTimeout(() => {
            try {
              process.kill(-group, "SIGKILL");
            } catch {}
          }, 5000);
          try {
            process.kill(-group, "SIGTERM");
            await new Promise<void>((resolve) =>
              web!.once("exit", () => resolve()),
            );
          } catch {
          } finally {
            clearTimeout(force);
          }
        }
      }
    } finally {
      const active = await database?.catch(() => undefined);
      await active?.stop();
      process.exitCode = exitCode;
      if (process.connected) process.disconnect?.();
    }
  })();
  return shutdown;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
  process.on(signal, () => {
    void stop(0);
  });
process.on("disconnect", () => {
  void stop(0);
});

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("ใช้ npm run start สำหรับ production");
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("ยังไม่มี DATABASE_URL กรุณารัน npm run setup:local ก่อน");
  if (usesLocalDatabase(url)) {
    database = startLocalDatabase({ databaseUrl: url });
    await database;
  } else {
    console.log(
      "[db] ใช้ฐานข้อมูลตาม DATABASE_URL โดยไม่เปิด MongoDB ในเครื่องเพิ่ม",
    );
  }
  if (stopping) return;
  web = spawn(
    process.execPath,
    [
      path.resolve("node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "127.0.0.1",
      ...process.argv.slice(2),
    ],
    {
      stdio: "inherit",
      windowsHide: true,
      detached: process.platform !== "win32",
    },
  );
  web.once("error", () => {
    console.error("[dev] เปิด Next.js ไม่สำเร็จ");
    void stop(1);
  });
  web.once("exit", (code) => {
    if (!stopping) void stop(code ?? 1);
  });
}

main().catch(async (error: unknown) => {
  console.error(
    "[dev]",
    error instanceof Error ? error.message : "เริ่มระบบไม่สำเร็จ",
  );
  await stop(1);
});
