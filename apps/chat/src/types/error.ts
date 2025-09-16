import { NextApiRequest } from 'next';

export interface ErrorMessage {
  code: string | null;
  title: string;
  messageLines: string[];
}

interface DialAIErrorOptions {
  type?: string;
  param?: string;
  displayMessage?: string;
}

export class DialAIError extends Error {
  code: string;
  requestUrl: string;
  type: string;
  param: string;
  displayMessage?: string;

  constructor(
    message: string,
    code: string | number,
    request: NextApiRequest | string,
    options?: DialAIErrorOptions,
  ) {
    super(message);
    this.name = 'DialAIError';
    this.requestUrl =
      typeof request === 'string'
        ? request
        : (request.url ?? request.headers.host ?? 'unknown request url');
    this.code = code + '';
    this.type = options?.type ?? '';
    this.param = options?.param ?? '';
    this.displayMessage = options?.displayMessage;
  }
}

export interface HttpErrorStatus extends Error {
  status?: number;
}
