const PDF_MAGIC_BYTES = '%PDF-';

export function isPdfBuffer(data: Uint8Array): boolean {
  if (data.byteLength < PDF_MAGIC_BYTES.length) {
    return false;
  }
  const header = Buffer.from(data.subarray(0, PDF_MAGIC_BYTES.length)).toString('latin1');
  return header === PDF_MAGIC_BYTES;
}
