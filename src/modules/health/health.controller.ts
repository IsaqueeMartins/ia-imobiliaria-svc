import { Controller, Get, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../shared/guards/public.decorator';
import { toOpenApiSchema } from '../../shared/openapi/openapi-schema';
import { HealthService } from './health.service';
import {
  LivenessResponse,
  ReadinessResponse,
  livenessResponseSchema,
  readinessResponseSchema,
} from './health.schema';

@ApiTags('Health')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Confirms the process is running. Does not call the AI provider.',
  })
  @ApiOkResponse({ schema: toOpenApiSchema(livenessResponseSchema, 'output') })
  liveness(): LivenessResponse {
    return this.healthService.liveness;
  }

  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Confirms the service is able to serve requests: configuration, AI provider credentials and storage availability. Never consumes AI credits.',
  })
  @ApiOkResponse({ schema: toOpenApiSchema(readinessResponseSchema, 'output') })
  @ApiResponse({ status: 503, schema: toOpenApiSchema(readinessResponseSchema, 'output') })
  async readiness(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponse> {
    const result = await this.healthService.readiness();
    response.status(result.status === 'ready' ? 200 : 503);
    return result;
  }
}
