import "dotenv/config";
import { startLocalDatabase } from "./local-database";

async function main() {
  const database = await startLocalDatabase();
  if (!database.owned) return;
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await database.stop();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
