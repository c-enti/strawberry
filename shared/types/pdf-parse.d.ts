declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PDFData>;
  export = pdfParse;
}
