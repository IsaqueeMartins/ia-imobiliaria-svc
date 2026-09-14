import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface PdfFixtureOptions {
  readonly pages?: number;
  readonly lines?: readonly string[];
}

export async function createPdfFixture(options: PdfFixtureOptions = {}): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pageCount = options.pages ?? 1;
  const lines = options.lines ?? ['Apartamento no Gonzaga', 'Venda R$ 750.000,00 - 120 m2'];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = document.addPage();
    page.drawText(`Pagina ${pageIndex + 1}`, { x: 40, y: 760, size: 12, font });
    lines.forEach((line, lineIndex) => {
      page.drawText(line, { x: 40, y: 720 - lineIndex * 18, size: 11, font });
    });
  }

  return Buffer.from(await document.save());
}

export function createInvalidPdfFixture(): Buffer {
  return Buffer.from('not a pdf document at all', 'utf8');
}
