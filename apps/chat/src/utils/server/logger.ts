import pino from 'pino';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import transport from 'pino-opentelemetry-transport';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import pretty from 'pino-pretty';

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
