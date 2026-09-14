import { ApiError, FileState, GoogleGenAI } from '@google/genai';
import { ERROR_CODES } from '../../../../src/shared/errors/error-codes';
import { GeminiDocumentPartFactory } from '../../../../src/modules/ai/infrastructure/gemini/gemini-document-part.factory';
import { GeminiProvider } from '../../../../src/modules/ai/infrastructure/gemini/gemini.provider';
import { PropertyDescriptionPromptBuilder } from '../../../../src/modules/ai/application/prompt/property-description.prompt';
import { PropertyExtractionPromptBuilder } from '../../../../src/modules/ai/application/prompt/property-extraction.prompt';
import { AiUsageRecorder } from '../../../../src/modules/ai/domain/ai-usage.port';
import { createExtractedProperty } from '../../../fixtures/property.fixture';
import { createSilentLogger, createTestConfig } from '../../../fixtures/config.fixture';

interface FakeClient {
  client: GoogleGenAI;
  generateContent: jest.Mock;
  upload: jest.Mock;
  getFile: jest.Mock;
  deleteFile: jest.Mock;
}

function createFakeClient(): FakeClient {
  const generateContent = jest.fn();
  const upload = jest.fn();
  const getFile = jest.fn();
  const deleteFile = jest.fn();

  const client = {
    models: { generateContent },
    files: { upload, get: getFile, delete: deleteFile },
  } as unknown as GoogleGenAI;

  return { client, generateContent, upload, getFile, deleteFile };
}

function createProvider(options: {
  client: GoogleGenAI;
  config?: Record<string, unknown>;
  usageRecorder?: AiUsageRecorder;
}) {
  const config = createTestConfig(options.config ?? {});

  return new GeminiProvider({
    client: options.client,
    options: {
      model: config.ai.model,
      extractionTemperature: 0,
      descriptionTemperature: config.ai.temperature,
    },
    extractionPrompt: new PropertyExtractionPromptBuilder(),
    descriptionPrompt: new PropertyDescriptionPromptBuilder(),
    documentParts: new GeminiDocumentPartFactory(options.client, config, createSilentLogger()),
    usageRecorder: options.usageRecorder ?? { record: jest.fn() },
  });
}

const pdfBytes = Buffer.from('%PDF-1.7 fake content for tests');
const extractionInput = {
  document: {
    data: pdfBytes,
    mimeType: 'application/pdf',
    filename: 'imoveis.pdf',
    pageCount: 3,
  },
};

describe('GeminiProvider', () => {
  it('returns validated properties and records usage', async () => {
    const fake = createFakeClient();
    const record = jest.fn();
    const provider = createProvider({ client: fake.client, usageRecorder: { record } });

    fake.generateContent.mockResolvedValue({
      text: JSON.stringify({ properties: [createExtractedProperty()], warnings: [] }),
      usageMetadata: {
        promptTokenCount: 1200,
        candidatesTokenCount: 300,
        totalTokenCount: 1500,
      },
      candidates: [{ finishReason: 'STOP' }],
    });

    const result = await provider.extractProperties(extractionInput);

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].title).toBe('Apartamento no Gonzaga');
    expect(result.model).toBe('gemini-3.1-flash-lite');
    expect(result.provider).toBe('gemini');
    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 300, totalTokens: 1500 });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        operation: 'extract_properties',
        errorCode: null,
      }),
    );
  });

  it('sends the PDF inline together with the structured output schema', async () => {
    const fake = createFakeClient();
    const provider = createProvider({ client: fake.client });
    fake.generateContent.mockResolvedValue({
      text: JSON.stringify({ properties: [], warnings: [] }),
      usageMetadata: {},
      candidates: [{ finishReason: 'STOP' }],
    });

    await provider.extractProperties(extractionInput);

    const request = fake.generateContent.mock.calls[0][0];
    const parts = request.contents[0].parts;

    expect(parts[0].inlineData.mimeType).toBe('application/pdf');
    expect(Buffer.from(parts[0].inlineData.data, 'base64').toString('latin1')).toContain('%PDF-');
    expect(parts[1].text).toContain('extraia todos os imóveis');
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.responseSchema.properties.properties).toBeDefined();
    expect(request.config.systemInstruction).toContain('Nunca invente informação');
    expect(request.config.temperature).toBe(0);
  });

  it('rejects responses that fail schema validation', async () => {
    const fake = createFakeClient();
    const record = jest.fn();
    const provider = createProvider({ client: fake.client, usageRecorder: { record } });

    fake.generateContent.mockResolvedValue({
      text: JSON.stringify({ properties: [{ title: 'Missing required fields' }], warnings: [] }),
      usageMetadata: {},
    });

    await expect(provider.extractProperties(extractionInput)).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_RESPONSE,
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', errorCode: ERROR_CODES.AI_INVALID_RESPONSE }),
    );
  });

  it('rejects invalid JSON and empty responses', async () => {
    const fake = createFakeClient();
    const provider = createProvider({ client: fake.client });

    fake.generateContent.mockResolvedValueOnce({ text: 'not-json', usageMetadata: {} });
    await expect(provider.extractProperties(extractionInput)).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_RESPONSE,
    });

    fake.generateContent.mockResolvedValueOnce({
      text: '',
      promptFeedback: { blockReason: 'SAFETY' },
      usageMetadata: {},
    });
    await expect(provider.extractProperties(extractionInput)).rejects.toMatchObject({
      code: ERROR_CODES.AI_INVALID_RESPONSE,
    });
  });

  it('maps provider rate limits', async () => {
    const fake = createFakeClient();
    const provider = createProvider({ client: fake.client });

    fake.generateContent.mockRejectedValue(new ApiError({ message: 'quota', status: 429 }));

    await expect(provider.extractProperties(extractionInput)).rejects.toMatchObject({
      code: ERROR_CODES.AI_RATE_LIMIT,
      retryable: true,
    });
  });

  it('returns the description for the description operation', async () => {
    const fake = createFakeClient();
    const provider = createProvider({ client: fake.client });
    fake.generateContent.mockResolvedValue({
      text: JSON.stringify({ description: 'Apartamento com varanda.' }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    });

    const result = await provider.generatePropertyDescription({
      property: { city: 'Santos' },
      style: 'professional',
    });

    expect(result.description).toBe('Apartamento com varanda.');
    expect(
      fake.generateContent.mock.calls[0][0].config.responseSchema.properties.description,
    ).toBeDefined();
  });

  it('uploads large documents through the Files API and deletes them afterwards', async () => {
    const fake = createFakeClient();
    const provider = createProvider({ client: fake.client, config: { GEMINI_INLINE_MAX_MB: '1' } });

    fake.upload.mockResolvedValue({
      name: 'files/abc',
      uri: 'https://generativelanguage.googleapis.com/v1beta/files/abc',
      state: FileState.ACTIVE,
    });
    fake.deleteFile.mockResolvedValue({});
    fake.generateContent.mockResolvedValue({
      text: JSON.stringify({ properties: [], warnings: [] }),
      usageMetadata: {},
    });

    const bigPdf = Buffer.concat([pdfBytes, Buffer.alloc(2 * 1024 * 1024)]);

    await provider.extractProperties({
      document: {
        data: bigPdf,
        mimeType: 'application/pdf',
        filename: 'grande.pdf',
        pageCount: 500,
      },
    });

    expect(fake.upload).toHaveBeenCalledTimes(1);
    expect(fake.getFile).not.toHaveBeenCalled();
    expect(fake.generateContent.mock.calls[0][0].contents[0].parts[0].fileData.fileUri).toContain(
      'files/abc',
    );
    expect(fake.deleteFile).toHaveBeenCalledWith({ name: 'files/abc' });
  });
});
