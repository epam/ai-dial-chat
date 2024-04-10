import config from '../../../config/chat.playwright.config';

import { API, Import } from '@/src/testData';
import { Page } from '@playwright/test';
import path from 'path';

export interface UploadDownloadData {
  path: string;
  isDownloadedData?: boolean;
}

const apiTimeout = 35000;
const responseThrottlingTimeout = 2500;

export class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateToBaseUrl() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToUrl(url: string) {
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openHomePage(
    options?: {
      iconsToBeLoaded?: (string | undefined)[];
      setEntitiesEnvVars?: boolean;
    },
    url?: string,
  ) {
    await this.waitForApiResponsesReceived(
      () => (url ? this.navigateToUrl(url) : this.navigateToBaseUrl()),
      options,
    );
  }

  async waitForIconLoaded<T>(method: () => Promise<T>, iconUrl: string) {
    const iconResponse = this.page.waitForResponse((response) =>
      response.url().includes(iconUrl),
    );
    const result = await method();
    await iconResponse;
    return result;
  }

  async waitForApiResponsesReceived(
    method: () => Promise<void>,
    options?: {
      iconsToBeLoaded?: (string | undefined)[];
      setEntitiesEnvVars?: boolean;
    },
  ) {
    const responses = [];
    const responseBodies = new Map<string, string>();
    const hostsArray = options?.setEntitiesEnvVars
      ? [API.modelsHost, API.addonsHost, API.sessionHost, API.bucketHost]
      : [API.bucketHost];
    for (const host of hostsArray) {
      const resp = this.page.waitForResponse(
        (response) =>
          response.url().includes(host) && response.status() === 200,
        { timeout: apiTimeout },
      );
      responses.push(resp);
    }
    if (options?.iconsToBeLoaded) {
      for (const iconHost of options.iconsToBeLoaded) {
        const resp = this.page.waitForResponse(
          (response) =>
            response.url().includes(iconHost!) && response.status() === 200,
          { timeout: apiTimeout },
        );
        responses.push(resp);
      }
    }
    await method();
    for (const resp of responses) {
      const resolvedResp = await resp;
      if (hostsArray) {
        const body = await resolvedResp.text();
        const host = resolvedResp.url();
        const baseURL = config.use?.baseURL;
        const apiHost = host.replaceAll(baseURL!, '');
        responseBodies.set(apiHost, body);
      }
    }
    return responseBodies;
  }

  async throttleAPIResponse(url: string, timeout?: number) {
    await this.page.route(url, async (route) => {
      await new Promise((f) =>
        setTimeout(f, timeout ?? responseThrottlingTimeout),
      );
      await route.continue();
    });
  }

  async unRouteAllResponses() {
    await this.page.unrouteAll({ behavior: 'ignoreErrors' });
  }

  async reloadPage() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  async bringPageToFront() {
    await this.page.bringToFront();
  }

  async getNewPage<T>(method: () => Promise<T>) {
    let newBrowserTab;
    try {
      [newBrowserTab] = await Promise.all([
        this.page.waitForEvent('popup'),
        method(),
      ]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Browser page is not loaded: ' + (e as Error).message);
    }
    await newBrowserTab?.bringToFront();
    return newBrowserTab;
  }

  async acceptBrowserDialog(message: string) {
    await this.page.once('dialog', (dialog) => dialog.accept(message));
  }

  async downloadData<T>(
    method: () => Promise<T>,
    filename?: string,
  ): Promise<UploadDownloadData> {
    const downloadPromise = this.page.waitForEvent('download');
    await method();
    const download = await downloadPromise;
    const filePath = path.join(
      Import.exportPath,
      filename ?? download.suggestedFilename(),
    );
    await download.saveAs(filePath);
    return { path: filePath, isDownloadedData: true };
  }

  public async uploadData<T>(
    uploadData: UploadDownloadData,
    method: () => Promise<T>,
  ) {
    const directory = uploadData.isDownloadedData ? '' : Import.importPath;
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await method();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(directory, uploadData.path));
  }
}
