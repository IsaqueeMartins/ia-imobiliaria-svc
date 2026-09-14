import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { safeStringify, sanitizeLogPayload } from './log-sanitizer';
import { RequestContextService } from './request-context';

type LogLevelName = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevelName, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private levels: readonly string[] = ['debug', 'info', 'warn', 'error'];

  constructor(
    private readonly requestContext: RequestContextService,
    private readonly config: AppConfigService,
  ) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.levels = levels;
  }

  private isEnabled(level: LogLevelName): boolean {
    const configured = this.config?.logging?.level ?? 'info';
    if (!this.levels.includes(level)) {
      return false;
    }
    if (configured === 'debug') {
      return true;
    }
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configured as LogLevelName];
  }

  private write(level: LogLevelName, message: unknown, optionalParams: unknown[]): void {
    if (!this.isEnabled(level)) {
      return;
    }

    const context = optionalParams.filter((param): param is string => typeof param === 'string');
    const extras = optionalParams.filter((param) => typeof param !== 'string');
    const current = this.requestContext.current();

    const payload: Record<string, unknown> = {};

    if (message !== null && typeof message === 'object' && !(message instanceof Error)) {
      Object.assign(payload, sanitizeLogPayload(message as Record<string, unknown>));
    } else if (message instanceof Error) {
      Object.assign(payload, sanitizeLogPayload({ error: message }));
      payload.errorMessage = message.message;
    } else {
      payload.msg = String(message);
    }

    if (extras.length > 0) {
      payload.meta = sanitizeLogPayload({ meta: extras.length === 1 ? extras[0] : extras }).meta;
    }

    payload.level = level;
    payload.time = new Date().toISOString();
    payload.msg = typeof payload.msg === 'string' ? payload.msg : (payload.event ?? 'log');
    payload.context = context.length > 0 ? context[context.length - 1] : null;

    if (current) {
      payload.requestId = current.requestId;
      payload.tenantId = current.tenantId;
      payload.consumerId = current.consumerId;
      payload.path = current.path;
    }

    const line = safeStringify(payload);
    if (level === 'error' || level === 'warn') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }
}
