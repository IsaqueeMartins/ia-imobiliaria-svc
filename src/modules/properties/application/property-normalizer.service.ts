import { Injectable } from '@nestjs/common';
import { AiExtractedProperty } from '../../../shared/types/property-contracts';
import { ExtractionWarning, NormalizedProperty } from '../domain/property-response.schema';
import {
  MAX_DESCRIPTION_LENGTH,
  countValue,
  featureValues,
  nonNegativeNumberValue,
  stateValue,
  textValue,
  transactionValue,
  typeValue,
  zipCodeValue,
} from './property-fields';
import {
  buildConfidence,
  dedupeWarnings,
  mapModelWarnings,
  normalizePageReferences,
} from './property-extraction-warnings';

export const PROPERTY_NORMALIZATION_FAILED_CODE = 'PROPERTY_NORMALIZATION_FAILED';

export interface NormalizePropertyInput {
  readonly property: AiExtractedProperty;
  readonly index: number;
  readonly pageCount: number;
}

@Injectable()
export class PropertyNormalizer {
  normalize(input: NormalizePropertyInput): NormalizedProperty {
    const { property, index, pageCount } = input;
    const warnings: ExtractionWarning[] = [];
    const context = { index, warnings };

    const pages = normalizePageReferences(property.sourcePages, pageCount, index, warnings);
    const location = {
      address: textValue(property.location?.address ?? null),
      number: textValue(property.location?.number ?? null),
      complement: textValue(property.location?.complement ?? null),
      neighborhood: textValue(property.location?.neighborhood ?? null),
      city: textValue(property.location?.city ?? null),
      state: stateValue(property.location?.state ?? null),
      zipCode: zipCodeValue(property.location?.zipCode ?? null),
    };
    const features = featureValues(property.features);

    const normalized = {
      title: textValue(property.title),
      type: typeValue(property.type, context),
      transaction: transactionValue(property.transaction, context),
      price: nonNegativeNumberValue(property.price, 'price', context),
      rentalPrice: nonNegativeNumberValue(property.rentalPrice, 'rentalPrice', context),
      condominiumFee: nonNegativeNumberValue(property.condominiumFee, 'condominiumFee', context),
      iptu: nonNegativeNumberValue(property.iptu, 'iptu', context),
      area: nonNegativeNumberValue(property.area, 'area', context),
      privateArea: nonNegativeNumberValue(property.privateArea, 'privateArea', context),
      builtArea: nonNegativeNumberValue(property.builtArea, 'builtArea', context),
      totalArea: nonNegativeNumberValue(property.totalArea, 'totalArea', context),
      bedrooms: countValue(property.bedrooms, 'bedrooms', context),
      suites: countValue(property.suites, 'suites', context),
      bathrooms: countValue(property.bathrooms, 'bathrooms', context),
      parkingSpaces: countValue(property.parkingSpaces, 'parkingSpaces', context),
      location,
      features,
      description: textValue(property.description, MAX_DESCRIPTION_LENGTH),
    };

    const allWarnings = dedupeWarnings([
      ...mapModelWarnings(property.warnings, pageCount, index),
      ...warnings,
    ]);
    const confidence = buildConfidence(
      property.confidence,
      normalized,
      features,
      allWarnings,
      index,
    );

    return {
      ...normalized,
      confidence: { overall: confidence.overall, fields: confidence.fields },
      source: { pages },
      warnings: dedupeWarnings([...allWarnings, ...confidence.warnings]),
    };
  }
}
