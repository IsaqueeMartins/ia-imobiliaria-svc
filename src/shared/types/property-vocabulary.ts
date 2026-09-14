export const PROPERTY_TYPES = [
  'apartment',
  'penthouse',
  'studio',
  'house',
  'townhouse',
  'land',
  'commercial',
  'rural',
  'other',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const TRANSACTIONS = ['sale', 'rent'] as const;

export type Transaction = (typeof TRANSACTIONS)[number];

export const DESCRIPTION_STYLES = ['professional', 'premium', 'direct', 'commercial'] as const;

export type DescriptionStyle = (typeof DESCRIPTION_STYLES)[number];

export const AI_WARNING_CODES = [
  'CONFLICTING_VALUE',
  'AMBIGUOUS_VALUE',
  'UNMAPPED_VALUE',
  'INVALID_VALUE',
  'OUT_OF_RANGE_PAGE',
  'MISSING_FIELD_CONFIDENCE',
  'NO_PROPERTIES_FOUND',
  'PARTIAL_PROPERTY_DATA',
  'IGNORED_INSTITUTIONAL_CONTENT',
] as const;

export type AiWarningCode = (typeof AI_WARNING_CODES)[number];

export const PROPERTY_FIELD_NAMES = [
  'title',
  'type',
  'transaction',
  'price',
  'rentalPrice',
  'condominiumFee',
  'iptu',
  'area',
  'privateArea',
  'builtArea',
  'totalArea',
  'bedrooms',
  'suites',
  'bathrooms',
  'parkingSpaces',
  'address',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
  'zipCode',
  'features',
  'description',
] as const;

export type PropertyFieldName = (typeof PROPERTY_FIELD_NAMES)[number];

export const DEFAULT_CONFIDENCE = 0.8;
export const AMBIGUOUS_CONFIDENCE = 0.5;
export const MAX_CONFIDENCE = 1;
export const MIN_CONFIDENCE = 0;

function lookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLookup<T extends string>(entries: Record<string, T>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [label, value] of Object.entries(entries)) {
    map.set(lookupKey(label), value);
  }
  return map;
}

const PROPERTY_TYPE_LOOKUP = buildLookup<PropertyType>({
  apartamento: 'apartment',
  ap: 'apartment',
  flat: 'apartment',
  'apartamento garden': 'apartment',
  cobertura: 'penthouse',
  'cobertura duplex': 'penthouse',
  penthouse: 'penthouse',
  kitnet: 'studio',
  'kit net': 'studio',
  studio: 'studio',
  conjugado: 'studio',
  casa: 'house',
  'casa em condominio': 'house',
  'casa de vila': 'house',
  sobrado: 'townhouse',
  townhouse: 'townhouse',
  'casa geminada': 'townhouse',
  terreno: 'land',
  lote: 'land',
  'area de terra': 'land',
  'sala comercial': 'commercial',
  'salao comercial': 'commercial',
  loja: 'commercial',
  galpao: 'commercial',
  galpão: 'commercial',
  comercial: 'commercial',
  'predio comercial': 'commercial',
  escritorio: 'commercial',
  sitio: 'rural',
  chacara: 'rural',
  fazenda: 'rural',
  rural: 'rural',
  outro: 'other',
  outros: 'other',
  other: 'other',
});

const TRANSACTION_LOOKUP = buildLookup<Transaction>({
  venda: 'sale',
  sale: 'sale',
  vender: 'sale',
  'a venda': 'sale',
  'para venda': 'sale',
  aluguel: 'rent',
  locacao: 'rent',
  rent: 'rent',
  alugar: 'rent',
  locar: 'rent',
  'para alugar': 'rent',
  'locacao e venda': 'rent',
});

export function normalizePropertyTypeLabel(value: string): PropertyType | null {
  return PROPERTY_TYPE_LOOKUP.get(lookupKey(value)) ?? null;
}

export function normalizeTransactionLabel(value: string): Transaction | null {
  return TRANSACTION_LOOKUP.get(lookupKey(value)) ?? null;
}

export function conflictingWarningCode(field: string): string {
  return `CONFLICTING_${field
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()}`;
}

export const BRAZILIAN_STATES: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
};

const VALID_STATE_CODES = new Set(Object.values(BRAZILIAN_STATES));

export function normalizeStateCode(value: string): string | null {
  const key = lookupKey(value);
  if (key.length === 0) {
    return null;
  }
  const upper = key.toUpperCase();
  if (VALID_STATE_CODES.has(upper)) {
    return upper;
  }
  return BRAZILIAN_STATES[key] ?? null;
}

export function normalizeZipCode(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) {
    return null;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
