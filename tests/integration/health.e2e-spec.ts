import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../fixtures/test-app';

describe('Health endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exposes a public liveness probe without consuming AI credits', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      environment: 'test',
      uptimeSeconds: expect.any(Number),
      timestamp: expect.any(String),
    });
    expect(response.headers['x-request-id']).toMatch(/^req_/);
  });

  it('exposes a public readiness probe with dependency details', async () => {
    const response = await request(app.getHttpServer()).get('/ready').expect(200);

    expect(response.body.status).toBe('ready');
    expect(response.body.checks).toEqual([
      expect.objectContaining({
        name: 'ai_provider',
        status: 'up',
        details: expect.objectContaining({ paidCall: false }),
      }),
      expect.objectContaining({ name: 'document_storage', status: 'unconfigured' }),
    ]);
  });

  it('echoes the provided request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', 'req_from_consumer')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('req_from_consumer');
  });

  it('returns the documented error contract for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/v1/unknown').expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: expect.any(String),
      requestId: expect.any(String),
    });
  });
});
