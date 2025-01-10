import config from '@/config/overlay.playwright.config';
import { APIRequestContext } from '@playwright/test';

export class BaseApiHelper {
  protected request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  //function to override the API host if overlay sandbox is running
  public getHost(endpoint: string) {
    if (
      process.env.NEXT_PUBLIC_OVERLAY_HOST &&
      config.use!.baseURL !== process.env.NEXT_PUBLIC_OVERLAY_HOST
    ) {
      endpoint = process.env.NEXT_PUBLIC_OVERLAY_HOST + endpoint;
    }
    return endpoint;
  }
}
