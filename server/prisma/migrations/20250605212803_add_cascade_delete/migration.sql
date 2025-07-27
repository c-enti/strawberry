-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_calendarId_fkey";

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
