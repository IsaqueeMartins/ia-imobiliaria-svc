import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContextState {
  requestId: string;
  tenantId: string | null;
  consumerId: string | null;
  method: string;
  path: string;
  idempotencyKey: string | null;
  replayed: boolean;
  startedAt: number;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextState>();

@Injectable()
export class RequestContextService {
  run<T>(state: RequestContextState, callback: () => T): T {
    return requestContextStorage.run(state, callback);
  }

  current(): RequestContextState | null {
    return requestContextStorage.getStore() ?? null;
  }

  get requestId(): string | null {
    return this.current()?.requestId ?? null;
  }

  markReplayed(): void {
    const state = this.current();
    if (state) {
      state.replayed = true;
    }
  }
}
