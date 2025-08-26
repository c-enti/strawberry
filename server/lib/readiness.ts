// server/lib/readiness.ts

import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let serverIsReady = false;

export async function initializeReadiness(): Promise<void> {
  try {
    // Run full health script (make sure script is executable)
    execSync("bash ./scripts/devcontainer_db_health_check.sh --all", { stdio: "inherit" });

    // Warm up Prisma and ensure schema presence
    await prisma.$connect();
    await prisma.$queryRaw`SELECT * FROM "Calendar" LIMIT 1`;
    await prisma.$queryRaw`SELECT * FROM "Event" LIMIT 1`;

    serverIsReady = true;
    console.log("✅ Server readiness checks passed.");
  } catch (err) {
    console.error("❌ Server failed readiness checks:", err);
    process.exit(1);
  }
}

// Utility accessor for other modules
export function isServerReady(): boolean {
  return serverIsReady;
}

export { prisma };
