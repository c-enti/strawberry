import { exportCalendarToPDF, PDFExportOptions } from "../utils/pdfExport";
import { PDFDocument, PageSizes } from "pdf-lib";

// Create a minimal valid PNG buffer (1x1 pixel, black)
const mockPngBuffer = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, // width=1
  0x00, 0x00, 0x00, 0x01, // height=1
  0x08,                   // bit depth
  0x06,                   // color type (RGBA)
  0x00,                   // compression
  0x00,                   // filter
  0x00,                   // interlace
  0x1F, 0x15, 0xC4, 0x89, // CRC
  0x00, 0x00, 0x00, 0x0A, // IDAT length
  0x49, 0x44, 0x41, 0x54, // "IDAT"
  0x78, 0x9C, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
  0xE5, 0x27, 0xDE, 0x48, // CRC
  0x00, 0x00, 0x00, 0x00, // IEND length
  0x49, 0x45, 0x4E, 0x44, // "IEND"
  0xAE, 0x42, 0x60, 0x82,  // CRC
import { exportCalendarToPDF, PDFExportOptions } from "../utils/pdfExport";
import { PDFDocument, PageSizes } from "pdf-lib";

// Create a mock PNG buffer that looks like real PNG data
const mockPngBuffer = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
  0x49, 0x48, 0x44, 0x52, // "IHDR" chunk type
]);

describe("PDF Export Utils", () => {
  const mockOptions: PDFExportOptions = {
    year: 2025,
    selectedMonths: ["January", "February"],
    events: [
      { date: "2025-01-01", title: "New Year" },
      { date: "2025-02-14", title: "Valentine's Day" },
    ],
  };

  afterEach(() => {
    jest.restoreAllMocks(); // Use restoreAllMocks to clean up spies
  });

  it("should create a PDF document with correct size and structure", async () => {
    const result = await exportCalendarToPDF(mockOptions);
    const pdfDoc = await PDFDocument.load(result);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    // A3 size verification using constants for maintainability
    const [expectedWidth, expectedHeight] = PageSizes.A3;
    expect(width).toBe(expectedWidth);
    expect(height).toBe(expectedHeight);

    // Basic structure verification
    expect(pdfDoc.getPages()).toHaveLength(1); // Single page for yearly view

    // Verify PDF can be serialized (validates internal structure)
    const pdfBytes = await pdfDoc.save();
    expect(pdfBytes.byteLength).toBeGreaterThan(1000); // Non-empty PDF
  });

  it("should handle background image loading by calling fetch", async () => {
    const options = {
      ...mockOptions,
      backgroundUrl: "data:image/png;base64,fake",
    };

    // Spy on fetch to ensure it's called correctly without mocking its implementation here
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        Promise.resolve({
            arrayBuffer: () => Promise.resolve(mockPngBuffer.buffer),
        }) as unknown as Response
    );

    await exportCalendarToPDF(options);

    // Verify image fetch
    expect(fetchSpy).toHaveBeenCalledWith(options.backgroundUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("should generate PDF with all required content", async () => {
    const result = await exportCalendarToPDF(mockOptions);
    const pdfDoc = await PDFDocument.load(result);
    const pdfBytes = await pdfDoc.save();

    // Use 'latin1' to read binary data as a string to find text objects
    const pdfString = Buffer.from(pdfBytes).toString("latin1");

    // A more reliable way to check for content is to look for PDF text objects.
    // The format is typically /T (Your Text)
    expect(pdfString).toContain("/T (2025)");

    mockOptions.selectedMonths.forEach((month) => {
      expect(pdfString).toContain(`/T (${month})`);
    });

    mockOptions.events.forEach((event) => {
      expect(pdfString).toContain(`/T (${event.title})`);
    });
  });

  it("should handle different month and event selections", async () => {
    const options = {
      ...mockOptions,
      selectedMonths: ["March"],
      events: [{ date: "2025-03-15", title: "Special Test Event" }],
    };

    const result = await exportCalendarToPDF(options);
    const pdfDoc = await PDFDocument.load(result);
    const pdfBytes = await pdfDoc.save();
    const pdfString = Buffer.from(pdfBytes).toString("latin1");

    // Verify new content is included
    expect(pdfString).toContain("/T (March)");
    expect(pdfString).toContain("/T (Special Test Event)");

    // Verify old content is not included
    expect(pdfString).not.toContain("/T (January)");
    expect(pdfString).not.toContain("/T (Valentine's Day)");
  });
});