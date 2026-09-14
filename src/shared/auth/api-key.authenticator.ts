import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ConsumerAuthenticator, ConsumerIdentity } from './consumer';

export interface ApiKeyEntry {
  readonly digest: string;
  readonly consumer: ConsumerIdentity;
}

const MINIMUM_API_KEY_LENGTH = 8;

export function parseApiKeyEntries(rawEntries: readonly string[]): ApiKeyEntry[] {
  return rawEntries
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separatorIndex = entry.indexOf(':');
      const apiKey = separatorIndex === -1 ? entry : entry.slice(0, separatorIndex);
      const tenantId = separatorIndex === -1 ? '' : entry.slice(separatorIndex + 1).trim();
      const digest = hashApiKey(apiKey);
      return {
        digest,
        consumer: {
          id: `key_${digest.slice(0, 16)}`,
          tenantId: tenantId.length > 0 ? tenantId : null,
        },
      } satisfies ApiKeyEntry;
    })
    .filter((entry) => entry.digest.length > 0);
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function digestsMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

@Injectable()
export class ApiKeyAuthenticator implements ConsumerAuthenticator {
  private readonly entries: ApiKeyEntry[];

  constructor(config: AppConfigService) {
    this.entries = parseApiKeyEntries(config.auth.apiKeyEntries);
  }

  authenticate(apiKey: string): ConsumerIdentity | null {
    if (typeof apiKey !== 'string' || apiKey.length < MINIMUM_API_KEY_LENGTH) {
      return null;
    }

    const digest = hashApiKey(apiKey);
    let matched: ApiKeyEntry | null = null;
    for (const entry of this.entries) {
      if (digestsMatch(entry.digest, digest)) {
        matched = entry;
      }
    }

    return matched ? matched.consumer : null;
  }
}
