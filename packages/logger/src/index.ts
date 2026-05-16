import pino, { type Logger, type LoggerOptions } from 'pino';

export type { Logger } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  base: {
    env: process.env.NODE_ENV,
    service: process.env.SERVICE_NAME ?? 'jobpilot',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
};

const devTransport: LoggerOptions['transport'] = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:HH:MM:ss.l',
    ignore: 'pid,hostname',
  },
};

export const createLogger = (name?: string, overrides: Partial<LoggerOptions> = {}): Logger => {
  const options: LoggerOptions = {
    ...baseOptions,
    ...overrides,
    ...(isProduction ? {} : { transport: devTransport }),
    ...(name ? { name } : {}),
  };
  return pino(options);
};

export const logger = createLogger();
