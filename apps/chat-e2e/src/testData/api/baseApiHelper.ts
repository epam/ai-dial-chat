import config, { overlayHost } from '@/config/chat.playwright.config';
import { APIRequestContext } from '@playwright/test';

export class BaseApiHelper {
  protected request: APIRequestContext;
  protected userBucket?: string;

  constructor(request: APIRequestContext, userBucket?: string) {
    this.request = request;
    this.userBucket = userBucket;
  }

  //function to override the API host if overlay sandbox is running
  public getHost(endpoint: string) {
    const baseUrl = config.use!.baseURL;
    if (baseUrl === overlayHost) {
      endpoint = process.env.NEXT_PUBLIC_OVERLAY_HOST + endpoint;
    }
    return endpoint;
  }
}
