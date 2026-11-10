import { randomBytes } from "node:crypto";
import { access, writeFile } from "node:fs/promises";

async function main() {
  try {
    await access(".env");
    console.log("มี .env แล้ว คงค่าปัจจุบันทั้งหมด");
    return;
  } catch {}
  const secret = () => randomBytes(32).toString("base64");
  await writeFile(
    ".env",
    [
      'DATABASE_URL="mongodb://127.0.0.1:27018/oneventone?replicaSet=rs0&directConnection=true"',
      'BETTER_AUTH_URL="http://127.0.0.1:3000"',
      `BETTER_AUTH_SECRET="${secret()}"`,
      `TICKET_ENCRYPTION_KEY="${secret()}"`,
      `JOB_SECRET="${secret()}"`,
      'STORAGE_DIRECTORY=".local/uploads"',
      'STORAGE_PERSISTENT="false"',
      'TRUSTED_CLIENT_IP_HEADER=""',
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
  console.log("สร้าง .env สำหรับเครื่องพัฒนาพร้อมกุญแจสุ่มแล้ว");
}
main().catch(() => {
  console.error("ไม่สามารถสร้าง .env ได้ ตรวจสอบสิทธิ์และไฟล์เดิม");
  process.exitCode = 1;
});
