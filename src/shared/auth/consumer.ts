export interface ConsumerIdentity {
  readonly id: string;
  readonly tenantId: string | null;
}

export const CONSUMER_AUTHENTICATOR = Symbol('CONSUMER_AUTHENTICATOR');

export interface ConsumerAuthenticator {
  authenticate(apiKey: string): ConsumerIdentity | null;
}
