import { PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export async function cleanupDatabase() {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename 
    FROM pg_tables
    WHERE schemaname='public'
  `;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== "_prisma_migrations");

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "public"."${table}" CASCADE;`
      );
    } catch (error) {
      console.error(`Error truncating table ${table}:`, error);
      throw error; // Make test fail if cleanup fails
    }
  }
}

export async function createTestCalendar(data: {
  year: number;
  selectedMonths: string[];
  events?: { date: string; title: string }[];
  backgroundUrl?: string;
  name?: string; // allow override
}) {
  return prisma.calendar.create({
    data: {
      name: data.name || `Test Calendar ${data.year}`,
      year: data.year,
      selectedMonths: data.selectedMonths,
      backgroundUrl: data.backgroundUrl,
      events: data.events
        ? {
            create: data.events,
          }
        : undefined,
    },
    include: {
      events: true,
    },
  });
}
