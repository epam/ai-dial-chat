import { OverlayRequest } from '@epam/ai-dial-shared';

const defaultRequestTimeout = 10000;

interface RequestParams {
  payload: unknown;
  timeout?: number;
}

export class DeferredRequest {
  public promise: Promise<unknown>;

  private type: string;
  private requestId: string;
  private _isReplied: boolean;

  private resolve!: (value: unknown) => void;

  private params: RequestParams;

  constructor(type: string, params: RequestParams) {
    this.type = type;
    this.params = params;

    this.requestId = DeferredRequest.generateRequestId();

    this._isReplied = false;

    this.promise = Promise.race([
      new Promise((resolve) => {
        this.resolve = resolve;
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            `[ChatOverlay] Request ${type} failed. Timeout ${
              this.params?.timeout || defaultRequestTimeout
            }`,
          );
        }, this.params?.timeout || defaultRequestTimeout);
      }),
    ]);
  }

  match(type: string, requestId: string) {
    return this.type + '/RESPONSE' === type && this.requestId === requestId;
  }

  reply(payload: unknown) {
    if (this.isReplied) return;
    this._isReplied = true;
    this.resolve(payload);
  }

  toPostMessage(): OverlayRequest {
    return {
      type: this.type,
      payload: this.params?.payload,
      requestId: this.requestId,
    };
  }

  get isReplied() {
    return this._isReplied;
  }

  private static generateRequestId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }
}
