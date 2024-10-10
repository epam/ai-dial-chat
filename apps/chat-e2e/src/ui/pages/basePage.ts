import config from '../../../config/chat.playwright.config';
import { keys } from '../keyboard';

import { API, Attachment, Import } from '@/src/testData';
import { Page } from '@playwright/test';
import path from 'path';
import { Response } from 'playwright-core';

export interface UploadDownloadData {
  path: string;
  dataType?: 'download' | 'upload';
}

export const responseThrottlingTimeout = 2500;

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
    const responses: Response[] = [];
    const responseBodies = new Map<string, string>();
    const hostsArray = options?.setEntitiesEnvVars
      ? [API.modelsHost, API.addonsHost, API.sessionHost, API.bucketHost]
      : [API.bucketHost];

    this.page.on('response', async (response) => {
      const url = response.url();
      if (
        hostsArray.find((host) => url.includes(host)) !== undefined &&
        response.ok()
      ) {
        responses.push(response);
      }
    });

    await method();
    for (const resp of responses) {
      if (hostsArray) {
        let body;
        try {
          body = await resp.text();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log('Response body not available for:', resp.url());
        }
        const host = resp.url();
        const baseURL = config.use?.baseURL;
        const overlayDomain = process.env.NEXT_PUBLIC_OVERLAY_HOST;
        const apiHost = host
          .replaceAll(baseURL!, '')
          .replaceAll(overlayDomain!, '');
        responseBodies.set(apiHost, body!);
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
      throw new Error();
    }
    await newBrowserTab?.bringToFront();
    return newBrowserTab;
  }

  async acceptBrowserDialog(message: string) {
    this.page.once('dialog', (dialog) => dialog.accept(message));
  }

  async downloadData<T>(
    method: () => Promise<T>,
    filename?: string,
  ): Promise<UploadDownloadData> {
    const downloadedData = await this.downloadMultipleData(method, 1, filename);
    return downloadedData[0];
  }

  async downloadMultipleData<T>(
    method: () => Promise<T>,
    expectedDownloadsCount: number,
    filename?: string[] | string,
  ) {
    const downloadedData: UploadDownloadData[] = [];
    let downloadCount = 0;
    const receivedDownloads = new Promise<void>((fulfill) => {
      this.page.on('download', async (download) => {
        const filenamePath = filename
          ? typeof filename === 'string'
            ? filename
            : filename[downloadCount]
          : download.suggestedFilename();
        const filePath = path.join(Import.exportPath, filenamePath);
        downloadCount = downloadCount + 1;
        downloadedData.push({ path: filePath, dataType: 'download' });
        await download.saveAs(filePath);
        if (downloadCount === expectedDownloadsCount) {
          fulfill();
        }
      });
    });
    await method();
    await receivedDownloads;
    return downloadedData;
  }

  public async uploadData<T>(
    uploadData: UploadDownloadData,
    method: () => Promise<T>,
  ) {
    let directory;
    const dataType = uploadData.dataType;
    switch (dataType) {
      case 'download':
        directory = '';
        break;
      case 'upload':
        directory = Attachment.attachmentPath;
        break;
      default:
        directory = Import.importPath;
    }
    const fileChooserPromise = this.page.waitForEvent('filechooser');
    await method();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(directory, uploadData.path));
  }

  public async copyWithKeyboard() {
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.page.keyboard.press(keys.ctrlPlusC);
  }

  public async pasteFromClipboard() {
    await this.page.keyboard.press(keys.ctrlPlusV);
  }

  public async copyToClipboard(text: string) {
    await this.page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      text,
    );
  }
}
