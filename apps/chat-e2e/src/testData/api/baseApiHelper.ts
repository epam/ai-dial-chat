import config from '@/config/chat.playwright.config';
import { APIRequestContext } from '@playwright/test';

export class BaseApiHelper {
  protected request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  //function to override the API host if overlay sandbox is running
  public getHost(endpoint: string) {
    const baseUrl = config.use!.baseURL;
    //overlay sandbox host includes 'overlay' prefix on CI env
    if (process.env.E2E_HOST) {
      if (baseUrl?.includes('overlay')) {
        endpoint = process.env.NEXT_PUBLIC_OVERLAY_HOST + endpoint;
      }
    } else {
      //overlay sandbox has different port on local env
      if (
        process.env.NEXT_PUBLIC_OVERLAY_HOST &&
        baseUrl !== process.env.NEXT_PUBLIC_OVERLAY_HOST
      ) {
        endpoint = process.env.NEXT_PUBLIC_OVERLAY_HOST + endpoint;
      }
    }
    return endpoint;
  }
}
