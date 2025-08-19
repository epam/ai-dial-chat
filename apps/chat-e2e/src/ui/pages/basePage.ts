import config from '../../../config/chat.playwright.config';
import { keys } from '../keyboard';

import { API, Attachment, Import } from '@/src/testData';
import { BucketUtil } from '@/src/utils';
import { Page } from '@playwright/test';
import * as fs from 'node:fs';
import path from 'path';
import { CDPSession, Download } from 'playwright-chromium';

export interface UploadDownloadData {
  path: string;
  dataType?: 'download' | 'upload';
}

export interface ExpectedApiResponse {
  apiMethod?: 'PUT' | 'POST' | 'DELETE' | 'GET';
  urlPattern?: string | RegExp;
  status?: number;
}

export const apiTimeout = 35000;
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
    await this.page.route('**', async (route) => route.continue());
    const responseBodies = new Map<string, string>();
    let expectedApiResponses: ExpectedApiResponse[];
    if (options?.setEntitiesEnvVars) {
      expectedApiResponses = [
        { apiMethod: 'GET', urlPattern: API.modelsHost },
        { apiMethod: 'GET', urlPattern: API.addonsHost },
        { apiMethod: 'GET', urlPattern: API.bucketHost },
        { apiMethod: 'GET', urlPattern: API.themesListingHost },
      ];
    } else {
      expectedApiResponses = [
        { apiMethod: 'GET', urlPattern: API.bucketHost },
        { urlPattern: API.installedDeploymentsHost() },
        { apiMethod: 'GET', urlPattern: API.publishedApplicationsHost() },
        { apiMethod: 'GET', urlPattern: API.filesListingHost() },
        { apiMethod: 'GET', urlPattern: API.publishedConversationsHost() },
        { apiMethod: 'GET', urlPattern: API.publishedPromptsHost() },
        { apiMethod: 'GET', urlPattern: API.appSchemasHost },
        { apiMethod: 'POST', urlPattern: API.shareListing },
      ];
    }
    if (options?.iconsToBeLoaded) {
      for (const iconHost of options.iconsToBeLoaded) {
        expectedApiResponses.push({ apiMethod: 'GET', urlPattern: iconHost! });
      }
    }
    const responses = await this.waitForExpectedResponses(
      () => method(),
      expectedApiResponses,
    );

    for (const response of responses) {
      let body;
      try {
        body = await response.text();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Response body not available for call: ', response.url());
        throw new Error();
      }
      const host = response.url();
      const baseURL = config.use?.baseURL;
      const overlayDomain = process.env.NEXT_PUBLIC_OVERLAY_HOST;
      const apiHost = host
        .replaceAll(baseURL!, '')
        .replaceAll(overlayDomain!, '');
      responseBodies.set(apiHost, body!);
    }
    await this.unRouteAllResponses();
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

  async emulateSlowNetworkConditions(conditions?: {
    offline?: boolean;
    latency?: number;
    downloadThroughput?: number;
    uploadThroughput?: number;
  }) {
    const client = await this.page.context().newCDPSession(this.page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: conditions?.offline ?? false,
      latency: conditions?.latency ?? 500, // slow down UI responsiveness
      downloadThroughput:
        conditions?.downloadThroughput ?? (5 * 1024 * 1024) / 8, // 5 Mbps download - reasonably fast
      uploadThroughput: conditions?.uploadThroughput ?? (50 * 1024) / 8, // 50 Kbps upload - very slow,
    });
    return client;
  }

  async stopNetworkConditionsEmulating(client: CDPSession) {
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1, // Disable throttling
      uploadThroughput: -1, // Disable throttling
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
    timeoutMs = 30000,
  ): Promise<UploadDownloadData[]> {
    const downloadedData: UploadDownloadData[] = [];
    const pendingDownloads = new Map<
      string,
      { download: Download; completed: boolean }
    >();
    let downloadCount = 0;

    const receivedDownloads = new Promise<void>((fulfill, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timeout waiting for ${expectedDownloadsCount} downloads. Received ${downloadCount}`,
          ),
        );
      }, timeoutMs);

      const handleDownload = async (download: Download) => {
        try {
          const filenamePath = filename
            ? typeof filename === 'string'
              ? filename
              : filename[downloadCount]
            : download.suggestedFilename();

          const filePath = path.join(Import.exportPath, filenamePath);
          pendingDownloads.set(filenamePath, { download, completed: false });

          await download.saveAs(filePath);
          const fileExists = await fs.promises
            .access(filePath)
            .then(() => true)
            .catch(() => false);

          if (!fileExists) {
            throw new Error(`File ${filenamePath} failed to download`);
          }

          downloadCount++;
          pendingDownloads.get(filenamePath)!.completed = true;
          downloadedData.push({ path: filePath, dataType: 'download' });

          if (downloadCount === expectedDownloadsCount) {
            clearTimeout(timeoutId);
            cleanup();
            fulfill();
          }
        } catch (error) {
          clearTimeout(timeoutId);
          cleanup();
          reject(error);
        }
      };

      const cleanup = () => {
        this.page.removeListener('download', handleDownload);
      };

      this.page.on('download', handleDownload);
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await method();
      await receivedDownloads;
      return downloadedData;
    } catch (error) {
      await Promise.all(
        downloadedData.map((data) =>
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          fs.promises.unlink(data.path).catch(() => {}),
        ),
      );
      throw new Error(`Download failed:`);
    }
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
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await this.page.waitForTimeout(500);
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

  public async readFromClipboard() {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  public async mockChatImageResponse(
    modelId: string,
    imageName: string,
    options?: { isOverlay: boolean },
  ) {
    await this.page.route(
      options?.isOverlay
        ? `${process.env.NEXT_PUBLIC_OVERLAY_HOST}${API.chatHost}`
        : API.chatHost,
      async (route) => {
        await route.fulfill({
          status: 200,
          body: `{"responseId":"0dea98ff-1e66-4294-8542-457890e5f8c0"}\u0000{"role":"assistant"}\u0000{"custom_content":{"attachments":[{"index":0,"type":"image/jpg","title":"Image","url":"${API.importFilePath(BucketUtil.getBucket(), modelId)}/${imageName}"}]}}\u0000{"content":" "}\u0000{}\u0000`,
        });
      },
    );
  }

  public async mockChatTextResponse(
    responseBody: string,
    options?: {
      isOverlay?: boolean;
      /** If true, let the request actually hit the server
       * and then override the response.
       * Defaults to false for backward-compatibility.
       */
      passThrough?: boolean;
    },
  ) {
    const urlToIntercept = options?.isOverlay
      ? `${process.env.NEXT_PUBLIC_OVERLAY_HOST}${API.chatHost}`
      : API.chatHost;

    await this.page.route(urlToIntercept, async (route) => {
      if (options?.passThrough) {
        // 1. Sends the request to the actual server.
        await route.fetch();
      }
      // 2. Replaces the real response body with our mocked body
      // Fulfill with our fake response, never hitting the server
      await route.fulfill({
        status: 200,
        body: responseBody,
      });
    });
  }

  public async waitForExpectedResponses(
    action: () => Promise<void>,
    expectedApiResponses: ExpectedApiResponse[],
    defaultStatus = 200,
    timeout = apiTimeout,
  ) {
    const responsePromises = [];
    for (const expectedResponse of expectedApiResponses) {
      const expectedStatus = expectedResponse.status ?? defaultStatus;
      const promise = this.page.waitForResponse(
        (response) => {
          const expectedMethod = expectedResponse.apiMethod;
          const methodMatch = expectedMethod
            ? response.request().method() === expectedMethod
            : true;
          const statusMatch = response.status() === expectedStatus;
          const urlPattern = expectedResponse.urlPattern;
          const responseUrl = response.url();
          const urlMatch = urlPattern
            ? urlPattern instanceof RegExp
              ? urlPattern.test(responseUrl)
              : responseUrl.includes(urlPattern)
            : true;
          return methodMatch && statusMatch && urlMatch;
        },
        { timeout: timeout },
      );
      responsePromises.push(promise);
    }
    await action();
    return await Promise.all(responsePromises);
  }
}
