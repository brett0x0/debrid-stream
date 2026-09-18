import pino from 'pino';
import { env } from '../config/env.js';
export const logger = pino({
    level: env.LOG_LEVEL,
    redact: {
        paths: [
            'req.headers.authorization',
            '*.rdToken',
            '*.token',
            '*.password',
            '*.secret',
            'params.config',
            'headers.authorization',
        ],
        censor: '***REDACTED***',
    },
    transport: env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});
