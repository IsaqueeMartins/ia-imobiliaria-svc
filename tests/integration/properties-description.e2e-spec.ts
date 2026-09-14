import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppError } from '../../src/shared/errors/app-error';
import { ERROR_CODES } from '../../src/shared/errors/error-codes';
import { createMockAiProvider } from '../fixtures/property.fixture';
import { createTestApp } from '../fixtures/test-app';

const API_KEY = 'test-consumer-key';
const ENDPOINT = '/v1/ai/properties/description';

describe('Property description endpoint (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a description from the provided payload', async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set('X-API-Key', API_KEY)
      .send({
        property: {
          type: 'apartment',
          transaction: 'sale',
          price: 750000,
          area: 120,
          bedrooms: 3,
          bathrooms: 2,
          parkingSpaces: 2,
          city: 'Santos',
          neighborhood: 'Gonzaga',
          features: ['varanda', 'piscina'],
        },
      })
      .expect(200);

    expect(response.body).toEqual({
      description: 'Apartamento com tres dormitórios no bairro Gonzaga.',
    });
    expect(response.headers['x-request-id']).toMatch(/^req_/);
    expect(response.headers['idempotency-replayed']).toBe('false');
  });

  it('accepts numeric values sent as strings', async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set('X-API-Key', API_KEY)
      .send({ property: { price: 'R$ 750.000,00', area: '120 m²' } })
      .expect(200);

    expect(response.body.description).toBeDefined();
  });

  it('rejects payloads without any property data', async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set('X-API-Key', API_KEY)
      .send({ property: {} })
      .expect(400);

    expect(response.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(response.body.details.issues[0].path).toBe('property');
  });

  it('rejects unknown property fields', async () => {
    const response = await request(app.getHttpServer())
      .post(ENDPOINT)
      .set('X-API-Key', API_KEY)
      .send({ property: { city: 'Santos', roofline: 'invented' } })
      .expect(400);

    expect(response.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('maps AI provider failures to the documented error contract', async () => {
    const provider = createMockAiProvider({
      generatePropertyDescription: jest.fn(async () => {
        throw new AppError({
          code: ERROR_CODES.AI_PROVIDER_ERROR,
          status: 502,
          message: 'Gemini model gemini-3.1-flash-lite returned HTTP 500: internal details',
        });
      }),
    });
    const { app: failingApp } = await createTestApp({ aiProvider: provider });

    const response = await request(failingApp.getHttpServer())
      .post(ENDPOINT)
      .set('X-API-Key', API_KEY)
      .send({ property: { city: 'Santos' } })
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      code: ERROR_CODES.AI_PROVIDER_ERROR,
      message: 'The AI provider returned an unexpected error.',
      requestId: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('internal details');

    await failingApp.close();
  });

  it('replays the same description for a repeated Idempotency-Key', async () => {
    const { app: idempotentApp, provider } = await createTestApp();
    const body = { property: { city: 'Santos', neighborhood: 'Gonzaga' } };

    const call = () =>
      request(idempotentApp.getHttpServer())
        .post(ENDPOINT)
        .set('X-API-Key', API_KEY)
        .set('Idempotency-Key', 'e2e-description-key')
        .send(body);

    const first = await call().expect(200);
    const second = await call().expect(200);

    expect(first.headers['idempotency-replayed']).toBe('false');
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(provider.generatePropertyDescription).toHaveBeenCalledTimes(1);

    await idempotentApp.close();
  });
});
