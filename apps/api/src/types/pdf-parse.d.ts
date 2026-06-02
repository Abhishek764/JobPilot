// pdf-parse ships its real implementation at this subpath; importing the package
// root runs debug code that reads a sample file. Declare the subpath we use.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }
  function pdfParse(data: Buffer | Uint8Array): Promise<PdfParseResult>;
  export default pdfParse;
}
