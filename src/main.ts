import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { configureApp } from './app.setup';
import { AppConfigService } from './shared/config/app-config.service';

async function bootstrap(): Promise<void> {
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(AppConfigService);

  configureApp(app);

  await app.listen(config.http.port, '0.0.0.0');

  process.stdout.write(
    `${JSON.stringify({
      event: 'app.started',
      level: 'info',
      msg: 'AI service listening',
      port: config.http.port,
      appVersion: process.env.APP_VERSION ?? 'unknown',
      environment: config.http.nodeEnv,
      primaryModel: config.ai.model,
      fallbackModels: config.ai.fallbackModels,
      storageConfigured: Boolean(config.storage.bucket),
    })}\n`,
  );
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      event: 'app.start_failed',
      level: 'error',
      msg: 'AI service failed to start',
      reason: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exit(1);
});
