import { PdfInspection } from './document.types';

export const PDF_INSPECTOR = Symbol('PDF_INSPECTOR');

export interface PdfInspector {
  inspect(data: Uint8Array): Promise<PdfInspection>;
}
