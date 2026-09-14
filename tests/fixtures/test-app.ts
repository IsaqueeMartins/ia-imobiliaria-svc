import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppConfigService } from '../../src/shared/config/app-config.service';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AiProvider, AI_PROVIDER } from '../../src/modules/ai/domain/ai-provider.port';
import {
  DOCUMENT_STORAGE,
  DocumentStorage,
} from '../../src/modules/documents/domain/document-storage.port';
import { createMockAiProvider } from './property.fixture';
import { createTestConfig } from './config.fixture';

export interface TestApp {
  readonly app: INestApplication;
  readonly provider: ReturnType<typeof createMockAiProvider>;
  readonly storage: DocumentStorage;
}

export async function createTestApp(
  options: {
    aiProvider?: AiProvider;
    storage?: DocumentStorage;
    env?: Record<string, unknown>;
  } = {},
): Promise<TestApp> {
  const provider = (options.aiProvider ?? createMockAiProvider()) as ReturnType<
    typeof createMockAiProvider
  >;
  const storage: DocumentStorage =
    options.storage ??
    ({
      name: 'fake-storage',
      isConfigured: () => false,
      getObject: async () => {
        throw new Error('storage should not be used in this test');
      },
      probe: async () => undefined,
    } satisfies DocumentStorage);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfigService)
    .useValue(createTestConfig(options.env))
    .overrideProvider(AI_PROVIDER)
    .useValue(provider)
    .overrideProvider(DOCUMENT_STORAGE)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication();
  configureApp(app, { swagger: false });
  await app.init();

  return { app, provider, storage };
}
