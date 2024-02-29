export interface ErrorMessage {
  code: string | null;
  title: string;
  messageLines: string[];
}

export class DialAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'DialAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}
