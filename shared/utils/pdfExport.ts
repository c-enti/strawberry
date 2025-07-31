// Main export function & integration logic
// drawMonthSection.ts -- Helper to render individual months + events
// constants.ts --	Month names, layout grid, shared values
// types.ts	-- TypeScript interfaces for CalendarEvent, Options etc.
import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";
import { PDFExportOptions } from "./types";
import { drawMonthSection } from "./drawMonthSection";
import { MONTH_NAMES, GRID_COLS, GRID_ROWS } from "./constants";

export type {
  PDFExportOptions,
  CalendarEvent,
  // other types...
} from "./types";

export async function exportCalendarToPDF({
  year,
  selectedMonths,
  events,
  backgroundUrl,
}: PDFExportOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.A3);
  const { width, height } = page.getSize();

  if (backgroundUrl) {
    const imgBytes = await fetch(backgroundUrl).then((r) => r.arrayBuffer());
    const img = backgroundUrl.startsWith("data:image/png")
      ? await pdfDoc.embedPng(imgBytes)
      : await pdfDoc.embedJpg(imgBytes);

    page.drawImage(img, {
      x: 0,
      y: 0,
      width,
      height,
      opacity: 0.5,
    });
  }

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const dayFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText(`${year} Calendar`, {
    x: 40,
    y: height - 60,
    size: 36,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  const cellWidth = (width - 80) / GRID_COLS;
  const cellHeight = (height - 120) / GRID_ROWS;

  for (let i = 0; i < 12; i++) {
    if (!selectedMonths.includes(MONTH_NAMES[i])) continue;

    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const xOffset = 40 + col * cellWidth;
    const yOffset = height - 100 - row * cellHeight;

    drawMonthSection(
      page,
      font,
      dayFont,
      year,
      i,
      cellWidth,
      cellHeight,
      xOffset,
      yOffset,
      events
    );
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
