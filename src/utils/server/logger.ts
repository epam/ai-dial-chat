import pino from 'pino';

export const logger = pino(
  process.env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }
    : undefined,
);
