import pino from 'pino';
import pretty from 'pino-pretty';

const stream = pretty({
  colorize: true,
  messageFormat: '{msg} [trace_id={trace_id}, span_id={span_id}]',
});

export const logger = pino(stream);
