import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IDEMPOTENCY_REPLAYED_HEADER, createRequestId } from '../../../shared/http/request-headers';
import { RequestContextService } from '../../../shared/logging/request-context';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { AuthenticatedRequest } from '../../../shared/types/authenticated-request';
import {
  PropertyDescriptionRequest,
  propertyDescriptionRequestSchema,
} from '../../../shared/types/property-contracts';
import { ExtractPropertiesUseCase } from '../application/extract-properties.use-case';
import { GeneratePropertyDescriptionUseCase } from '../application/generate-property-description.use-case';
import {
  ExtractPropertiesResponse,
  PropertyDescriptionResponse,
} from '../domain/property-response.schema';
import {
  ApiAiErrorResponses,
  ApiConsumerErrorResponses,
  ApiConsumerHeaders,
  ApiDescriptionBody,
  ApiDescriptionResponse,
  ApiExtractPropertiesBody,
  ApiExtractionResponse,
} from './properties.docs';
import {
  ExtractPropertiesRequest,
  extractPropertiesRequestSchema,
} from './schemas/extract-properties.request';

@ApiTags('AI Properties')
@Controller('v1/ai/properties')
export class PropertiesController {
  constructor(
    private readonly extractPropertiesUseCase: ExtractPropertiesUseCase,
    private readonly generateDescriptionUseCase: GeneratePropertyDescriptionUseCase,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Extract properties from a PDF',
    description:
      'Reads an entire PDF document (standard or scanned, any layout) and returns every property found as structured data, with confidence, source pages, warnings and errors. Requires X-API-Key.',
  })
  @ApiConsumerHeaders()
  @ApiConsumerErrorResponses()
  @ApiAiErrorResponses()
  @ApiExtractPropertiesBody()
  @ApiExtractionResponse()
  async extract(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(extractPropertiesRequestSchema)) body: ExtractPropertiesRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ExtractPropertiesResponse> {
    const outcome = await this.extractPropertiesUseCase.execute({
      source: {
        file: file ?? null,
        reference: {
          tenantId: body.tenantId ?? null,
          documentId: body.documentId ?? null,
          objectKey: body.objectKey ?? null,
        },
      },
      requestId: this.resolveRequestId(request),
      tenantId: request.tenantId ?? null,
    });

    response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, String(outcome.replayed));

    return outcome.response;
  }

  @Post('description')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate a property description',
    description:
      'Writes a Brazilian Portuguese marketing description using only the structured data received. Requires X-API-Key.',
  })
  @ApiConsumerHeaders()
  @ApiConsumerErrorResponses()
  @ApiAiErrorResponses()
  @ApiDescriptionBody()
  @ApiDescriptionResponse()
  async describe(
    @Body(new ZodValidationPipe(propertyDescriptionRequestSchema)) body: PropertyDescriptionRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PropertyDescriptionResponse> {
    const outcome = await this.generateDescriptionUseCase.execute(body);

    response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, String(outcome.replayed));

    return outcome.response;
  }

  private resolveRequestId(request: AuthenticatedRequest): string {
    return request.requestId ?? this.requestContext.requestId ?? createRequestId();
  }
}
