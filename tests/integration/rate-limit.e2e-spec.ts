import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ERROR_CODES } from '../../src/shared/errors/error-codes';
import { createTestApp } from '../fixtures/test-app';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const created = await createTestApp({
      env: {
        RATE_LIMIT_ENABLED: 'true',
        RATE_LIMIT_MAX: '2',
        RATE_LIMIT_TTL: '60000',
      },
    });
    app = created.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('limits requests per consumer instead of per IP', async () => {
    const call = () =>
      request(app.getHttpServer())
        .post('/v1/ai/properties/description')
        .set('X-API-Key', 'test-consumer-key')
        .send({ property: { city: 'Santos' } });

    await call().expect(200);
    await call().expect(200);

    const limited = await call().expect(429);

    expect(limited.body).toEqual({
      statusCode: 429,
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests for this consumer. Try again later.',
      requestId: expect.any(String),
    });
  });

  it('does not apply to public health endpoints', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
