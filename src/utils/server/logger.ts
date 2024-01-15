import pino from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      messageFormat: '{msg} [trace_id={trace_id}, span_id={span_id}]',
    },
  },
});
