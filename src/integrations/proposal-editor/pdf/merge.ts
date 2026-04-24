// Mescla o PDF principal (Buffer) com PDFs anexados baixados do storage.
import { PDFDocument } from "pdf-lib";

/**
 * Concatena o PDF base com os PDFs anexados (na ordem fornecida).
 * Anexos que falharem ao baixar/abrir são ignorados (best-effort).
 */
export async function mergePdfBuffers(
  basePdf: Uint8Array | Buffer,
  attachedPdfs: Array<Uint8Array | Buffer>,
): Promise<Uint8Array> {
  const merged = await PDFDocument.load(basePdf);

  for (const buf of attachedPdfs) {
    try {
      const attached = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(attached, attached.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch (err) {
      console.warn("[mergePdfBuffers] anexo ignorado:", err);
    }
  }

  return merged.save();
}
