import pino from 'pino';
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

// Old pino console logger
// export const logger = pino({
//   transport: {
//     target: 'pino-pretty',
//     options: {
//       colorize: true,
//       messageFormat: '{msg} [trace_id={trace_id}, span_id={span_id}]',
//     },
//   },
// });
