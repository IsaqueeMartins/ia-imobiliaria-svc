export interface StorageObject {
  readonly data: Buffer;
  readonly contentType: string | null;
  readonly contentLength: number | null;
}

export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface DocumentStorage {
  readonly name: string;
  isConfigured(): boolean;
  getObject(objectKey: string): Promise<StorageObject>;
  probe(): Promise<void>;
}
