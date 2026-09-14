import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/shared.module';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [SharedModule, AiModule, DocumentsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
