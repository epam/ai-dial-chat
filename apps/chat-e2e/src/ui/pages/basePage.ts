import config from '../../../config/chat.playwright.config';
import { keys } from '../keyboard';

import { BackendDataEntity } from '@/chat/types/common';
import { API, Attachment, Import } from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { BucketUtil, FileUtil } from '@/src/utils';
import { Locator, Page } from '@playwright/test';
import { fileTypeFromFile } from 'file-type';
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

export interface FileMetadata {
  name: string;
  mimeType: string;
  buffer: string;
}

export type DropImplementation = (
  fileMetadata: FileMetadata,
  targetLocator: BaseElement | Locator,
  onDropPropName: string,
) => Promise<void>;

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

  public async pasteFromClipboard(options?: {
    triggeredApiResponse: ExpectedApiResponse;
  }) {
    if (options?.triggeredApiResponse) {
      const expectedStatus = options.triggeredApiResponse.status ?? 200;
      const respPromise = this.page.waitForResponse((response) => {
        const expectedMethod = options.triggeredApiResponse?.apiMethod;
        const methodMatch = expectedMethod
          ? response.request().method() === expectedMethod
          : true;
        const statusMatch = response.status() === expectedStatus;
        const urlPattern = options.triggeredApiResponse?.urlPattern;
        const responseUrl = response.url();
        const urlMatch = urlPattern
          ? urlPattern instanceof RegExp
            ? urlPattern.test(responseUrl)
            : responseUrl.includes(urlPattern)
          : true;
        return methodMatch && statusMatch && urlMatch;
      });
      await this.page.keyboard.press(keys.ctrlPlusV);
      const response = await respPromise;
      return response.json();
    }
    await this.page.keyboard.press(keys.ctrlPlusV);
  }

  public async copyTextToClipboard(text: string) {
    await this.page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      text,
    );
  }

  //For security reasons, browsers strictly control which data types a script can programmatically write to the clipboard
  //Chrome standardized on image/png as the only universally reliable and safely supported format
  //The Clipboard API has no standard mechanism to include metadata like filenames when copying binary content
  //This is why pasted images get generic names like "image.png"
  public async copyFileToClipboard(filename: string): Promise<void> {
    try {
      const fileToCopy = await this.getAttachmentFileMetadata(filename);

      // Throw error if not PNG
      if (fileToCopy.mimeType !== 'image/png') {
        throw new Error(
          `Only PNG images are supported. Detected type: ${fileToCopy}`,
        );
      }

      // Copy PNG to clipboard
      await this.page.evaluate(async (fileToCopy) => {
        const response = await fetch(
          `data:${fileToCopy.mimeType};base64,${fileToCopy.buffer}`,
        );
        const blob = await response.blob();

        // use the newly created blob with the Clipboard API
        await navigator.clipboard.write([
          new ClipboardItem({ [fileToCopy.mimeType]: blob }),
        ]);
      }, fileToCopy);
    } catch (error) {
      console.error(`Error copying file to clipboard: ${filename}`, error);
      throw error;
    }
  }

  //To bypass browser's engine limitation, simulate a "paste" event into a web page element
  public async triggerPasteFileEvent(
    filename: string,
    options?: {
      pasteToElement?: Locator | BaseElement;
      isHttpMethodTriggered?: boolean;
    },
  ) {
    const {
      pasteToElement,
      isHttpMethodTriggered = true,
    } = options || {};
    // 1. Focus on element that support 'paste' event
    if (pasteToElement) {
      // eslint-disable-next-line playwright/no-force-option
      await pasteToElement.click({ force: true });
    }

    // 2. Read the file and prepare the data payload.
    const fileToPaste = await this.getAttachmentFileMetadata(filename);

    let respPromise;
    if (isHttpMethodTriggered) {
      respPromise = this.page.waitForResponse((response) => {
        return (
          response.url().includes(API.fileHost()) &&
          response.request().method() === 'POST' &&
          response.status() === 200
        );
      });
    }

    // 3. Create a DataTransfer object in the browser context and dispatch a 'paste' event
    await this.page.evaluate(async (file) => {
      // Create the DataTransfer object, which is the container for clipboard data
      const dt = new DataTransfer();

      // Convert the base64 string back to a Blob, then create a File object
      const response = await fetch(
        `data:${file.mimeType};base64,${file.buffer}`,
      );
      const blob = await response.blob();
      const newFile = new File([blob], file.name, { type: file.mimeType });

      // Add the file to the DataTransfer object
      dt.items.add(newFile);

      // Create the 'paste' event, attaching the DataTransfer object to the clipboardData property
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: dt,
      });

      // Dispatch the event onto the currently focused element
      document.activeElement?.dispatchEvent(pasteEvent);
    }, fileToPaste);

    if (isHttpMethodTriggered) {
      const resolvedResp = await respPromise;
      const responseBody = await resolvedResp?.json();
      return responseBody as BackendDataEntity;
    }
  }

  public async readTextFromClipboard() {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  /**
   * Executes a component's 'onDrop' prop by passing a highly realistic mock event object.
   *
   * @param fileMetadata The file metadata to upload
   * @param targetLocator The locator for the DOM element of the React component
   * @param onDropPropName The name of the prop that handles the file drop (e.g., 'onDrop')
   */
  public async executeReactOnDrop(
    fileMetadata: FileMetadata,
    targetLocator: BaseElement | Locator,
    onDropPropName: string,
  ) {
    // const fileToUpload = await this.getAttachmentFile(filename);
    targetLocator =
      targetLocator instanceof BaseElement
        ? targetLocator.getElementLocator()
        : (targetLocator as Locator);

    // This is a surgical strike directly into the application's logic
    await targetLocator.evaluate(
      async (element, { file, propName }) => {
        // Step 1: Create a File object inside the browser.
        // Create an array of files, which matches the `files: File[]` signature of the handleUpload function
        const response = await fetch(
          `data:${file.mimeType};base64,${file.buffer}`,
        );
        const blob = await response.blob();
        const filesArray = [
          new File([blob], file.name, { type: file.mimeType }),
        ];

        // Step 2: Create a highly realistic DataTransfer object
        const dataTransfer = {
          files: filesArray,
          items: filesArray.map((f) => ({
            kind: 'file',
            type: f.type,
            getAsFile: () => f,
            // The function that was missing, now mocked.
            webkitGetAsEntry: () => ({
              isFile: true,
              isDirectory: false,
              name: f.name,
              file: (callback: (f: File) => void) => callback(f),
            }),
          })),
          types: ['Files'],
        };

        // Step 3: Create the MOCK event object with the methods the library needs
        const mockEvent = {
          preventDefault: () => void 0,
          stopPropagation: () => void 0,
          dataTransfer: dataTransfer,
        };

        // Step 4: Find the React component's props on its DOM element
        const propsKey = Object.keys(element).find((key) =>
          key.startsWith('__reactProps$'),
        );
        if (!propsKey) {
          throw new Error(
            'Could not find React props on the target element. Is this a React component?',
          );
        }

        // Step 5: Access the onDrop function from the props
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onDropFunction = (element as any)[propsKey][propName];
        if (typeof onDropFunction !== 'function') {
          throw new Error(
            `Prop "${propName}" is not a function on the component's props.`,
          );
        }

        // Step 6: Call the function with the fully mocked event
        onDropFunction(mockEvent);
      },
      { file: fileMetadata, propName: onDropPropName },
    );
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

  public async getAttachmentFileMetadata(
    filename: string,
  ): Promise<FileMetadata> {
    const resolvedPath = path.join(Attachment.attachmentPath, filename);
    const buffer = FileUtil.readPlainFileData(resolvedPath);
    const fileTypeResult = await fileTypeFromFile(resolvedPath);
    return {
      name: filename,
      mimeType: fileTypeResult?.mime || 'application/octet-stream',
      buffer: buffer.toString('base64'),
    };
  }
}
