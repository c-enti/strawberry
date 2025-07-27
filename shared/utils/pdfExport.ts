import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface CalendarEvent {
  date: string;
  title: string;
}

export interface PDFExportOptions {
  year: number;
  selectedMonths: string[];
  events: CalendarEvent[];
  backgroundUrl?: string;
}

export async function exportCalendarToPDF({
  year,
  selectedMonths,
  events,
  backgroundUrl,
}: PDFExportOptions) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 1191]); // A3 size for a yearly calendar
  const { width, height } = page.getSize();

  // Draw background image if provided
  if (backgroundUrl) {
    const imgBytes = await fetch(backgroundUrl).then((r) => r.arrayBuffer());
    let img;
    if (backgroundUrl.startsWith("data:image/png")) {
      img = await pdfDoc.embedPng(imgBytes);
    } else {
      img = await pdfDoc.embedJpg(imgBytes);
    }
    page.drawImage(img, {
      x: 0,
      y: 0,
      width,
      height,
      opacity: 0.5,
    });
  }

  // Draw title
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText(`${year} Calendar`, {
    x: 40,
    y: height - 60,
    size: 36,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Draw months grid (3 columns x 4 rows)
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const gridCols = 3;
  const gridRows = 4;
  const cellWidth = (width - 80) / gridCols;
  const cellHeight = (height - 120) / gridRows;

  for (let i = 0; i < months.length; i++) {
    if (!selectedMonths.includes(months[i])) continue;
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const x = 40 + col * cellWidth;
    const y = height - 100 - row * cellHeight;
    // Month title
    page.drawText(months[i], {
      x: x + 8,
      y: y - 32,
      size: 18,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    // Days grid
    const daysInMonth = new Date(year, i + 1, 0).getDate();
    const firstDay = new Date(year, i, 1).getDay();
    const dayFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let dayX = x + 8;
    let dayY = y - 56;
    let day = 1;
    for (let week = 0; week < 6; week++) {
      for (let d = 0; d < 7; d++) {
        if ((week === 0 && d < firstDay) || day > daysInMonth) {
          dayX += 22;
          continue;
        }
        page.drawText(String(day), {
          x: dayX,
          y: dayY,
          size: 10,
          font: dayFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        // Draw events
        const dateStr = `${year}-${String(i + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;
        const dayEvents = events.filter((e) => e.date === dateStr);
        if (dayEvents.length > 0) {
          page.drawText(dayEvents.map((e) => e.title).join(", "), {
            x: dayX,
            y: dayY - 10,
            size: 7,
            font: dayFont,
            color: rgb(0.7, 0.4, 0.1),
          });
        }
        dayX += 22;
        day++;
      }
      dayX = x + 8;
      dayY -= 18;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
