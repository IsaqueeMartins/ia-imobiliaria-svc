import { PropertyDescriptionPayload } from '../../../shared/types/property-contracts';
import { featureValues, stateValue, textValue, zipCodeValue } from './property-fields';

const MAX_CITY_LENGTH = 120;
const MAX_NEIGHBORHOOD_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 300;
const MAX_ZIP_CODE_LENGTH = 20;

function firstDefined<T>(...values: readonly (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

function assign<K extends keyof PropertyDescriptionPayload>(
  target: PropertyDescriptionPayload,
  key: K,
  value: PropertyDescriptionPayload[K],
): void {
  if (value !== null && value !== undefined && value !== '') {
    target[key] = value;
  }
}

export function buildDescriptionPayload(
  payload: PropertyDescriptionPayload,
): PropertyDescriptionPayload {
  const nested = payload.location ?? null;
  const normalized: PropertyDescriptionPayload = {};

  assign(normalized, 'title', textValue(payload.title ?? null));
  assign(normalized, 'type', payload.type ?? null);
  assign(normalized, 'transaction', payload.transaction ?? null);
  assign(normalized, 'price', payload.price ?? null);
  assign(normalized, 'rentalPrice', payload.rentalPrice ?? null);
  assign(normalized, 'condominiumFee', payload.condominiumFee ?? null);
  assign(normalized, 'iptu', payload.iptu ?? null);
  assign(normalized, 'area', payload.area ?? null);
  assign(normalized, 'privateArea', payload.privateArea ?? null);
  assign(normalized, 'builtArea', payload.builtArea ?? null);
  assign(normalized, 'totalArea', payload.totalArea ?? null);
  assign(normalized, 'bedrooms', payload.bedrooms ?? null);
  assign(normalized, 'suites', payload.suites ?? null);
  assign(normalized, 'bathrooms', payload.bathrooms ?? null);
  assign(normalized, 'parkingSpaces', payload.parkingSpaces ?? null);
  assign(
    normalized,
    'address',
    textValue(firstDefined(payload.address, nested?.address), MAX_ADDRESS_LENGTH),
  );
  assign(normalized, 'number', textValue(firstDefined(payload.number, nested?.number)));
  assign(normalized, 'complement', textValue(firstDefined(payload.complement, nested?.complement)));
  assign(
    normalized,
    'neighborhood',
    textValue(firstDefined(payload.neighborhood, nested?.neighborhood), MAX_NEIGHBORHOOD_LENGTH),
  );
  assign(normalized, 'city', textValue(firstDefined(payload.city, nested?.city), MAX_CITY_LENGTH));
  assign(normalized, 'state', stateValue(firstDefined(payload.state, nested?.state)));
  assign(
    normalized,
    'zipCode',
    zipCodeValue(textValue(firstDefined(payload.zipCode, nested?.zipCode), MAX_ZIP_CODE_LENGTH)),
  );
  assign(normalized, 'description', textValue(payload.description ?? null, 4000));

  const features = featureValues(payload.features ?? []);
  if (features.length > 0) {
    normalized.features = features;
  }

  return normalized;
}
