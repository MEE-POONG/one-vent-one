import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  oneVentOnePrisma?: PrismaClient;
};
export const prisma =
  globalForPrisma.oneVentOnePrisma ?? new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== "production")
  globalForPrisma.oneVentOnePrisma = prisma;
