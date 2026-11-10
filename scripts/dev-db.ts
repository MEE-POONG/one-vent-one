import "dotenv/config";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Local development database cannot run in production.");
  const dbPath = path.resolve(".local/mongodb");
  await mkdir(dbPath, { recursive: true });
  const replica = await MongoMemoryReplSet.create({
    binary: { version: "8.0.17" },
    instanceOpts: [{ port: 27018, dbPath, storageEngine: "wiredTiger" }],
    replSet: {
      name: "rs0",
      count: 1,
      storageEngine: "wiredTiger",
      ip: "127.0.0.1",
    },
  });
  console.log(
    "OneVentOne development MongoDB ready at 127.0.0.1:27018 (replica set rs0). Data persists in .local/mongodb.",
  );
  const stop = async () => {
    await replica.stop({ doCleanup: false });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
