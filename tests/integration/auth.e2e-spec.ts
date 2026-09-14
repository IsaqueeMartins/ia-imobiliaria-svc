import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../fixtures/test-app';

describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests without an API key', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/description')
      .send({ property: { city: 'Santos' } })
      .expect(401);

    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toContain('X-API-Key');
  });

  it('rejects invalid API keys', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/description')
      .set('X-API-Key', 'wrong-key-value')
      .send({ property: { city: 'Santos' } })
      .expect(401);

    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toContain('not valid');
  });

  it('rejects a tenant that does not match the consumer', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/description')
      .set('X-API-Key', 'test-consumer-key')
      .set('X-Tenant-Id', 'another-tenant')
      .send({ property: { city: 'Santos' } })
      .expect(403);

    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('rejects malformed tenant headers', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/description')
      .set('X-API-Key', 'test-consumer-key')
      .set('X-Tenant-Id', 'tenant with spaces!')
      .send({ property: { city: 'Santos' } })
      .expect(400);

    expect(response.body.code).toBe('INVALID_REQUEST');
  });

  it('accepts the tenant bound to the API key', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ai/properties/description')
      .set('X-API-Key', 'test-consumer-key')
      .set('X-Tenant-Id', 'tenant-test')
      .send({ property: { city: 'Santos' } })
      .expect(200);

    expect(response.body.description).toBeDefined();
  });
});
