import pino from 'pino';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import pretty from 'pino-pretty';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      messageFormat: '{msg} [trace_id={trace_id}, span_id={span_id}]',
    },
  },
});
