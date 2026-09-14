import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigService } from './shared/config/app-config.service';
import { validateEnv } from './shared/config/env.schema';
import { AllExceptionsFilter } from './shared/errors/all-exceptions.filter';
import { ApiKeyGuard } from './shared/guards/api-key.guard';
import { RequestContextInterceptor } from './shared/interceptors/request-context.interceptor';
import { RequestLoggingInterceptor } from './shared/interceptors/request-logging.interceptor';
import { SharedModule } from './shared/shared.module';
import { AiModule } from './modules/ai/ai.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { PropertiesModule } from './modules/properties/properties.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.rateLimit.ttlMs,
            limit: config.rateLimit.max,
          },
        ],
        skipIf: () => !config.rateLimit.enabled,
        getTracker: (request: Record<string, unknown>) => {
          const consumer = request.consumer as { id?: string } | undefined;
          const tenantId = request.tenantId as string | undefined;
          const ip = request.ip as string | undefined;
          return consumer?.id ?? tenantId ?? ip ?? 'unknown';
        },
      }),
    }),
    SharedModule,
    AiModule,
    DocumentsModule,
    IdempotencyModule,
    PropertiesModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
