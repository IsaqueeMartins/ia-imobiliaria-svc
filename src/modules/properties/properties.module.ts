import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppConfigService } from '../../shared/config/app-config.service';
import { SharedModule } from '../../shared/shared.module';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { ExtractPropertiesUseCase } from './application/extract-properties.use-case';
import { GeneratePropertyDescriptionUseCase } from './application/generate-property-description.use-case';
import { PropertyNormalizer } from './application/property-normalizer.service';
import { PropertiesController } from './presentation/properties.controller';

@Module({
  imports: [
    SharedModule,
    AiModule,
    DocumentsModule,
    IdempotencyModule,
    MulterModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        storage: memoryStorage(),
        limits: { fileSize: config.documents.maxDocumentSizeBytes, files: 1 },
      }),
    }),
  ],
  controllers: [PropertiesController],
  providers: [PropertyNormalizer, ExtractPropertiesUseCase, GeneratePropertyDescriptionUseCase],
})
export class PropertiesModule {}
