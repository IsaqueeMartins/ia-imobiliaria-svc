import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyAuthenticator } from './auth/api-key.authenticator';
import { CONSUMER_AUTHENTICATOR } from './auth/consumer';
import { AppConfigService } from './config/app-config.service';
import { RequestContextService } from './logging/request-context';
import { StructuredLoggerService } from './logging/structured-logger.service';
import { RetryPolicy, SLEEP_FUNCTION, defaultSleep } from './resilience/retry-policy';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    AppConfigService,
    RequestContextService,
    StructuredLoggerService,
    RetryPolicy,
    { provide: SLEEP_FUNCTION, useValue: defaultSleep },
    { provide: CONSUMER_AUTHENTICATOR, useClass: ApiKeyAuthenticator },
  ],
  exports: [
    AppConfigService,
    RequestContextService,
    StructuredLoggerService,
    RetryPolicy,
    CONSUMER_AUTHENTICATOR,
  ],
})
export class SharedModule {}
