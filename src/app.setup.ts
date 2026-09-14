import { INestApplication, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppConfigService } from './shared/config/app-config.service';
import { StructuredLoggerService } from './shared/logging/structured-logger.service';
import { requestIdMiddleware } from './shared/middleware/request-id.middleware';
import {
  API_KEY_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  REQUEST_ID_HEADER,
  TENANT_ID_HEADER,
} from './shared/http/request-headers';

const ALLOWED_CORS_METHODS = ['GET', 'POST', 'OPTIONS'];

export function configureApp(app: INestApplication, options: { swagger?: boolean } = {}): void {
  const config = app.get(AppConfigService);
  const logger = app.get(StructuredLoggerService);

  app.useLogger(logger);

  const expressApp = app as NestExpressApplication;
  expressApp.set('trust proxy', config.http.trustProxy ? 1 : false);

  const bodyLimitOptions = { limit: config.http.bodyLimit };
  expressApp.use(json(bodyLimitOptions));
  expressApp.use(urlencoded({ ...bodyLimitOptions, extended: true }));

  app.use(requestIdMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: config.http.corsOrigins.length > 0 ? [...config.http.corsOrigins] : false,
    credentials: false,
    methods: ALLOWED_CORS_METHODS,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      API_KEY_HEADER,
      TENANT_ID_HEADER,
      REQUEST_ID_HEADER,
      IDEMPOTENCY_KEY_HEADER,
    ],
    exposedHeaders: [REQUEST_ID_HEADER, 'Idempotency-Replayed'],
    maxAge: 86400,
  });

  app.enableShutdownHooks();

  const swaggerEnabled = options.swagger ?? config.http.swaggerEnabled;
  if (swaggerEnabled) {
    registerSwagger(app);
  }
}

function registerSwagger(app: INestApplication): void {
  const documentConfig = new DocumentBuilder()
    .setTitle('Imobiliária AI Service')
    .setDescription(
      'Independent AI microservice for Brazilian real-estate platforms: PDF property extraction and property description generation.',
    )
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: API_KEY_HEADER, in: 'header' }, 'api-key')
    .addTag('AI Properties', 'Property extraction from PDF and description generation')
    .addTag('Health', 'Liveness and readiness probes')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true, docExpansion: 'list' },
    customSiteTitle: 'Imobiliária AI Service — Docs',
  });

  new Logger('Bootstrap').log('Swagger documentation available at /docs');
}
