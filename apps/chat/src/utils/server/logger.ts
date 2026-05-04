import pino from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-opentelemetry-transport',
    options: {
      logRecordProcessorOptions: [
        { recordProcessorType: 'batch', exporterOptions: { protocol: 'http' } },
        {
          recordProcessorType: 'simple',
          exporterOptions: {
            protocol: 'console',
          },
        },
      ],
    },
  },
});
