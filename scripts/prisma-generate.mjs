// `prisma generate` that also works on Windows while `npm run dev` is running.
//
// A running Node process keeps the Prisma query engine DLL loaded, and Windows
// refuses to overwrite a loaded DLL, so plain `prisma generate` fails with EPERM
// halfway through (client code written, engine and schema copy not). Windows does
// allow *renaming* a loaded DLL, so the old engine is moved aside first and Prisma
// writes a fresh one. Moved-aside files are deleted once nothing holds them.
//
// A running dev server still has the previous client in memory: restart it after
// a schema change.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const clientDir = path.resolve("node_modules/.prisma/client");
const isEngine = (name) =>
  /^(lib)?query[_-]engine/.test(name) && !/\.(tmp|old)/.test(name);
const isLeftover = (name) =>
  /^(lib)?query[_-]engine.*\.(tmp\d+|old-\d+)$/.test(name);

function files(filter) {
  return existsSync(clientDir) ? readdirSync(clientDir).filter(filter) : [];
}

/** Deletes leftovers from earlier runs; returns how many are still locked. */
function cleanLeftovers() {
  let locked = 0;
  for (const name of files(isLeftover)) {
    try {
      rmSync(path.join(clientDir, name));
    } catch {
      locked++;
    }
  }
  return locked;
}

const moved = [];
if (process.platform === "win32") {
  cleanLeftovers();
  for (const name of files(isEngine)) {
    const aside = `${name}.old-${Date.now()}`;
    try {
      renameSync(path.join(clientDir, name), path.join(clientDir, aside));
      moved.push([name, aside]);
    } catch {
      // Could not move it; Prisma will report the real problem below.
    }
  }
}

const result = spawnSync(
  process.execPath,
  [path.resolve("node_modules/prisma/build/index.js"), "generate"],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  // Put the previous engine back so the existing client keeps working.
  for (const [name, aside] of moved)
    if (!existsSync(path.join(clientDir, name)))
      try {
        renameSync(path.join(clientDir, aside), path.join(clientDir, name));
      } catch {}
  console.error(
    "\nprisma generate ไม่สำเร็จ ถ้าขึ้น EPERM ให้ปิด npm run dev แล้วลองใหม่",
  );
  process.exit(result.status ?? 1);
}

if (moved.length && cleanLeftovers() > 0)
  console.log(
    "\nสร้าง Prisma client ใหม่แล้ว แต่ยังมีโปรแกรมที่ใช้ client เดิมอยู่ (น่าจะเป็น npm run dev)" +
      "\nให้ปิดแล้วเปิด npm run dev ใหม่ เพื่อให้ใช้ schema ล่าสุด",
  );
