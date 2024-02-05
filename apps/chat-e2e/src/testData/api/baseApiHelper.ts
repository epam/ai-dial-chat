import { APIRequestContext } from '@playwright/test';

export class BaseApiHelper {
  protected request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }
}
