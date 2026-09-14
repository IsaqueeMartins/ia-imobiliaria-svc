import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiResponse,
  ApiSecurity,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { errorResponseSchema } from '../../../shared/errors/error-response.schema';
import { toOpenApiSchema } from '../../../shared/openapi/openapi-schema';
import { propertyDescriptionRequestSchema } from '../../../shared/types/property-contracts';
import {
  extractPropertiesResponseSchema,
  propertyDescriptionResponseSchema,
} from '../domain/property-response.schema';
import { extractPropertiesRequestSchema } from './schemas/extract-properties.request';

const errorSchema = toOpenApiSchema(errorResponseSchema, 'output');
const requestIdHeaderSchema = { schema: { type: 'string', example: 'req_0f8d0d1c' } };

export function ApiConsumerHeaders() {
  return applyDecorators(
    ApiSecurity('api-key'),
    ApiHeader({
      name: 'X-API-Key',
      required: true,
      description: 'Consumer credential. Never send it from a browser frontend.',
    }),
    ApiHeader({
      name: 'X-Tenant-Id',
      required: false,
      description: 'Tenant context for traceability. Must match the tenant bound to the API key.',
    }),
    ApiHeader({
      name: 'X-Request-Id',
      required: false,
      description: 'Correlation id echoed back in the X-Request-Id response header.',
    }),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description:
        'Replays the stored response when the same key and payload are sent again, avoiding duplicate AI cost.',
    }),
  );
}

export function ApiConsumerErrorResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse({ schema: errorSchema, description: 'Missing or invalid API key.' }),
    ApiForbiddenResponse({
      schema: errorSchema,
      description: 'The consumer is not allowed to use the requested tenant.',
    }),
    ApiBadRequestResponse({ schema: errorSchema, description: 'Malformed request payload.' }),
    ApiTooManyRequestsResponse({
      schema: errorSchema,
      description: 'Rate limit exceeded for this consumer.',
    }),
  );
}

export function ApiAiErrorResponses() {
  return applyDecorators(
    ApiUnprocessableEntityResponse({
      schema: errorSchema,
      description: 'Unsupported document or AI extraction failure.',
    }),
    ApiPayloadTooLargeResponse({
      schema: errorSchema,
      description: 'Document exceeds the configured size or page limits.',
    }),
    ApiNotFoundResponse({ schema: errorSchema, description: 'Referenced document not found.' }),
    ApiResponse({
      status: 502,
      schema: errorSchema,
      description: 'AI provider error, invalid AI response or storage failure.',
    }),
    ApiResponse({ status: 504, schema: errorSchema, description: 'AI provider timeout.' }),
    ApiResponse({ status: 429, schema: errorSchema, description: 'AI provider rate limit.' }),
  );
}

export function ApiExtractPropertiesBody() {
  return applyDecorators(
    ApiConsumes('multipart/form-data', 'application/json'),
    ApiBody({
      required: false,
      description:
        'Send the PDF as a multipart field named "file", or send a JSON body with an objectKey reference to a PDF stored in the configured bucket.',
      schema: toOpenApiSchema(extractPropertiesRequestSchema),
    }),
    ApiBody({
      required: true,
      description: 'Send the PDF as a multipart field named "file".',
      schema: {
        type: 'object',
        properties: { file: { type: 'string', format: 'binary' } },
        required: ['file'],
      },
    }),
  );
}

export function ApiExtractionResponse() {
  return applyDecorators(
    ApiOkResponse({
      schema: toOpenApiSchema(extractPropertiesResponseSchema, 'output'),
      description: 'All properties found in the document, with warnings, errors and source pages.',
      headers: {
        'X-Request-Id': requestIdHeaderSchema,
        'Idempotency-Replayed': { schema: { type: 'boolean' } },
      },
    }),
  );
}

export function ApiDescriptionBody() {
  return applyDecorators(
    ApiBody({
      required: true,
      schema: toOpenApiSchema(propertyDescriptionRequestSchema),
      description: 'Structured property data. Only the provided fields are used to write the text.',
    }),
  );
}

export function ApiDescriptionResponse() {
  return applyDecorators(
    ApiOkResponse({
      schema: toOpenApiSchema(propertyDescriptionResponseSchema, 'output'),
      description: 'Property description written in Brazilian Portuguese.',
      headers: {
        'X-Request-Id': requestIdHeaderSchema,
        'Idempotency-Replayed': { schema: { type: 'boolean' } },
      },
    }),
  );
}
