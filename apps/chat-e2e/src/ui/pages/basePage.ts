import config from '../../../config/chat.playwright.config';
import { keys } from '../keyboard';

import { BackendDataEntity } from '@/chat/types/common';
import { API, Attachment, ExpectedConstants, Import } from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { BucketUtil, FileUtil, ItemUtil } from '@/src/utils';
import { JSHandle, Locator, Page } from '@playwright/test';
import { fileTypeFromFile } from 'file-type';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import path from 'path';
import { CDPSession, Download } from 'playwright-chromium';

export interface UploadDownloadData {
  path: string | string[];
  dataType?: 'download' | 'upload';
}

export interface ExpectedApiResponse {
  apiMethod?: 'PUT' | 'POST' | 'DELETE' | 'GET';
  urlPattern?: string | RegExp;
  status?: number;
  requestBodyPattern?: string | RegExp;
}

export interface FileMetadata {
  name: string;
  mimeType: string;
  buffer: string;
}

export type DropImplementation = (
  filesMetadata: FileMetadata[],
  targetLocator: BaseElement | Locator,
  onDropPropName: string,
) => Promise<void>;

export const apiTimeout = 235000;
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
        { apiMethod: 'GET', urlPattern: API.bucketHost },
        { apiMethod: 'GET', urlPattern: API.themesListingHost },
        { apiMethod: 'GET', urlPattern: API.appSchemasHost },
      ];
    } else {
      expectedApiResponses = [
        { apiMethod: 'GET', urlPattern: API.bucketHost },
        { urlPattern: API.installedDeploymentsHost() },
        { apiMethod: 'GET', urlPattern: API.publishedApplicationsHost() },
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
    const { responses: responses } = await this.waitForExpectedResponses(
      () => method(),
      expectedApiResponses,
    );

    for (const response of responses) {
      let body;
      try {
        body = await response.text();
      } catch {
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
    } catch {
      await Promise.all(
        downloadedData.map((data) => {
          const paths = Array.isArray(data.path) ? data.path : [data.path];
          return Promise.all(
            paths.map((p) =>
              fs.promises.unlink(p).catch((e) => {
                console.error(
                  `Failed to delete file ${p}:`,
                  (e as Error).message,
                );
              }),
            ),
          );
        }),
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
    const filePaths = Array.isArray(uploadData.path)
      ? uploadData.path.map((p) => path.join(directory, p))
      : path.join(directory, uploadData.path);
    await fileChooser.setFiles(filePaths);
    await this.page.waitForTimeout(500);
  }

  public async copyWithKeyboard() {
    await this.page.keyboard.press(keys.ctrlPlusA);
    await this.page.keyboard.press(keys.ctrlPlusC);
  }

  public async pasteFromClipboard(options?: {
    triggeredApiResponses: ExpectedApiResponse[];
  }) {
    if (options?.triggeredApiResponses) {
      const responseBodies = [];
      const { responses: responses } = await this.waitForExpectedResponses(
        () => this.page.keyboard.press(keys.ctrlPlusV),
        options.triggeredApiResponses,
      );
      for (const response of responses) {
        const responseBody = await response?.json();
        responseBodies.push(responseBody);
      }
      return responseBodies;
    }
    await this.page.keyboard.press(keys.ctrlPlusV);
  }

  public async copyTextToClipboard(text: string) {
    await this.page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      text,
    );
  }

  // For security reasons, browsers strictly control which data types a script can programmatically write to the clipboard
  // Chrome standardized on image/png as the only universally reliable and safely supported format
  // The Clipboard API has no standard mechanism to include metadata like filenames when copying binary content
  // This is why pasted images get generic names like "image.png"
  public async copyImageContentToClipboard(filename: string): Promise<void> {
    try {
      const fileMetadata =
        await this.getAttachmentFileMetadataAndContent(filename);

      // Throw error if not PNG
      if (fileMetadata.mimeType !== 'image/png') {
        throw new Error(
          `Only PNG images are supported. Detected type: ${fileMetadata.mimeType}`,
        );
      }

      // Copy PNG to clipboard
      await this.page.evaluate(async (metadata) => {
        const response = await fetch(
          `data:${metadata.mimeType};base64,${metadata.buffer}`,
        );
        const blob = await response.blob();

        // use the newly created blob with the Clipboard API
        await navigator.clipboard.write([
          new ClipboardItem({ [metadata.mimeType]: blob }),
        ]);
      }, fileMetadata);
    } catch (error) {
      console.error(`Error copying content to clipboard: ${filename}`, error);
      throw error;
    }
  }

  // To bypass browser's engine limitation, simulate a "paste" event into a web page element
  public async triggerPasteFilesEvent(
    filenames: string[],
    options?: {
      pasteToElement?: Locator | BaseElement;
      isHttpMethodTriggered?: boolean;
    },
  ) {
    const { pasteToElement, isHttpMethodTriggered = true } = options || {};
    // 1. Focus on element that support 'paste' event
    if (pasteToElement) {
      await pasteToElement.click({ force: true });
    }

    const filesMetadata: FileMetadata[] = [];
    const expectedApiResponses: ExpectedApiResponse[] = [];

    for (const filename of filenames) {
      // 2. Read the file and prepare the data payload.
      const fileMetadata =
        await this.getAttachmentFileMetadataAndContent(filename);
      filesMetadata.push(fileMetadata);

      if (isHttpMethodTriggered) {
        // Compose urlPattern to match the following requirements:
        // restricted chars are replaced with '_';
        // index is added for the duplicated names
        const urlFilename = ExpectedConstants.replacedRestrictedCharsName(
          filename.substring(0, filename.lastIndexOf('.')),
        );
        expectedApiResponses.push({
          apiMethod: 'POST',
          urlPattern: ItemUtil.getEncodedItemId(urlFilename),
        });
      }
    }

    // 3. Create a DataTransfer object in the browser context and dispatch a 'paste' event
    const { responses: responses } = await this.waitForExpectedResponses(
      () => this.firePasteFilesEvent(filesMetadata),
      expectedApiResponses,
    );

    //4. Populate array with response bodies
    const responseBodies: BackendDataEntity[] = [];
    for (const response of responses) {
      const responseBody = await response?.json();
      responseBodies.push(responseBody as BackendDataEntity);
    }
    return responseBodies;
  }

  private async firePasteFilesEvent(filesToPaste: FileMetadata[]) {
    // Call the common helper to create File objects in the browser
    const browserFilesHandle = await this.createBrowserFiles(filesToPaste);

    await this.page.evaluate(async (filesArray) => {
      // Create the DataTransfer object, which is the container for clipboard data
      const dt = new DataTransfer();
      filesArray.forEach((file) => dt.items.add(file));

      // Create the 'paste' event, attaching the DataTransfer object to the clipboardData property
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: dt,
      });

      // Dispatch the event onto the currently focused element
      document.activeElement?.dispatchEvent(pasteEvent);
    }, browserFilesHandle);
  }

  public async readTextFromClipboard() {
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  public async captureNextClipboardWrite(
    action: () => Promise<void>,
  ): Promise<string> {
    await this.page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__capturedClipboardText = undefined;

      const origWriteText = Clipboard.prototype.writeText;
      Clipboard.prototype.writeText = function (this: Clipboard, text: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__capturedClipboardText = text;
        Clipboard.prototype.writeText = origWriteText;
        return origWriteText.call(this, text);
      };

      const origWrite = Clipboard.prototype.write;
      Clipboard.prototype.write = async function (
        this: Clipboard,
        items: ClipboardItem[],
      ) {
        Clipboard.prototype.write = origWrite;
        try {
          const blob = await items[0].getType('text/plain');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__capturedClipboardText = await blob.text();
        } catch {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__capturedClipboardText = '';
        }
        return origWrite.call(this, items);
      };
    });
    await action();
    await this.page.waitForFunction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__capturedClipboardText !== undefined,
    );
    return this.page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__capturedClipboardText as string,
    );
  }

  /**
   * Executes a component's 'onDrop' prop by passing a highly realistic mock event object
   *
   * @param filesMetadata The files metadata array to attach
   * @param targetElement The DOM element of the React component
   * @param onDropPropName The name of the prop that handles the file drop (e.g., 'onDrop')
   */
  public executeReactOnDrop = async (
    filesMetadata: FileMetadata[],
    targetElement: BaseElement | Locator,
    onDropPropName: string,
  ): Promise<void> => {
    const locator = BaseElement.getElementLocator(targetElement);

    // Call the common helper to create File objects in the browser
    const browserFilesHandle = await this.createBrowserFiles(filesMetadata);

    // Use the handle to the files to build the specific mock 'drop' event
    const mockEventHandle = await locator.evaluateHandle(
      (element, filesArray) => {
        // Create a highly realistic DataTransfer object
        const dataTransfer = {
          files: filesArray,
          items: filesArray.map((f) => ({
            kind: 'file',
            type: f.type,
            getAsFile: () => f,
            webkitGetAsEntry: () => ({
              isFile: true,
              isDirectory: false,
              name: f.name,
              file: (callback: (f: File) => void) => callback(f),
            }),
          })),
          types: ['Files'],
        };

        // Return the MOCK event object with the methods the library needs
        return {
          preventDefault: () => void 0,
          stopPropagation: () => void 0,
          dataTransfer,
        };
      },
      browserFilesHandle,
    );

    // Call the generic prop executor for the built event
    await this.executeReactProp(locator, onDropPropName, mockEventHandle);
  };

  /**
   * Simulates a 'drag over' event on a React component by calling its onDragOverPropName prop
   * This is used to trigger UI changes, like showing a drop zone overlay
   *
   * @param targetElement The DOM element of the React component
   * @param onDragOverPropName The name of the prop that handles the drag over event (e.g., 'onDragOver')
   * @param dragTypes An array of strings representing the data types being dragged. Defaults to ['Files']
   */
  public executeReactOnDragOver = async (
    targetElement: Locator | BaseElement,
    onDragOverPropName = 'onDragOver',
    dragTypes = ['Files'],
  ): Promise<void> => {
    const locator = BaseElement.getElementLocator(targetElement);

    const mockEvent = await locator.evaluateHandle(
      (element, { types }) => {
        return {
          preventDefault: () => void 0,
          stopPropagation: () => void 0,
          dataTransfer: {
            types: types,
          },
        };
      },
      { types: dragTypes },
    );

    await this.executeReactProp(locator, onDragOverPropName, mockEvent);
  };

  public async mockChatImageResponse(
    modelId: string,
    imageName: string,
    options?: { isOverlay?: boolean; customPath?: string },
  ) {
    const imagePath =
      options?.customPath ??
      API.importFilePath(BucketUtil.getBucket(), modelId);
    await this.page.route(
      options?.isOverlay
        ? `${process.env.NEXT_PUBLIC_OVERLAY_HOST}${API.chatHost}`
        : API.chatHost,
      async (route) => {
        const responseId = `chatcmpl-${crypto.randomUUID()}`;
        const imageExtension = imageName.split('.').pop();
        const imageType = `image/${
          imageExtension === 'jpg' ? 'jpeg' : imageExtension
        }`;
        const mainJson = {
          content: '',
          custom_content: {
            attachments: [
              {
                index: 0,
                title: imageName,
                type: imageType,
                url: `${imagePath}/${imageName}`,
              },
            ],
          },
          role: 'assistant',
        };
        await route.fulfill({
          status: 200,
          body: `{"responseId":"${responseId}"}\u0000${JSON.stringify(
            mainJson,
          )}\u0000`,
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

  public async waitForExpectedResponses<T>(
    action: () => Promise<T>,
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
          const requestBodyPattern = expectedResponse.requestBodyPattern;
          const requestBody = response.request().postData();
          const bodyMatch =
            requestBodyPattern && requestBody
              ? requestBodyPattern instanceof RegExp
                ? requestBodyPattern.test(requestBody)
                : requestBody.includes(requestBodyPattern)
              : true;
          return methodMatch && statusMatch && urlMatch && bodyMatch;
        },
        { timeout: timeout },
      );
      responsePromises.push(promise);
    }

    const actionResult = await action();

    const responses = [];
    for (let i = 0; i < responsePromises.length; i++) {
      try {
        const response = await responsePromises[i];
        responses.push(response);
      } catch (error) {
        const expectedResponse = expectedApiResponses[i];
        console.error('[API Request Failed]', {
          method: expectedResponse.apiMethod || 'ANY',
          urlPattern: expectedResponse.urlPattern?.toString() || 'ANY',
          expectedStatus: expectedResponse.status ?? defaultStatus,
          body: expectedResponse.requestBodyPattern?.toString() ?? 'ANY',
          timeout: timeout,
          error: (error as Error).message,
        });
        throw error;
      }
    }

    return { actionResult: actionResult, responses: responses };
  }

  public async getAttachmentFileMetadataAndContent(
    filename: string,
  ): Promise<FileMetadata> {
    const resolvedPath = path.join(Attachment.attachmentPath, filename);
    const fileTypeResult = await fileTypeFromFile(resolvedPath);
    return {
      name: filename,
      mimeType: fileTypeResult?.mime || 'application/octet-stream',
      buffer: FileUtil.getBase64FileContent(resolvedPath),
    };
  }

  /**
   * Creates an array of browser-native File objects from metadata
   * This code is executed in the browser and returns a handle to the result
   * @param filesMetadata The array of file descriptions
   * @returns A JSHandle pointing to the created File[] array in the browser
   */
  private async createBrowserFiles(
    filesMetadata: FileMetadata[],
  ): Promise<JSHandle<File[]>> {
    return this.page.evaluateHandle(async (metadataArray) => {
      const filePromises = metadataArray.map(async (metadata) => {
        // the 'fetch' API converts the Base64-encoded data URL into a response object
        const response = await fetch(
          `data:${metadata.mimeType};base64,${metadata.buffer}`,
        );
        // convert the response object into a low-level binary object representing binary file data
        const blob = await response.blob();
        // create a browser-compatible File object from the blob
        return new File([blob], metadata.name, { type: metadata.mimeType });
      });
      return Promise.all(filePromises);
    }, filesMetadata);
  }

  /**
   * The private core "engine". Its only job is to find a prop on a React component and call it with a pre-built mock event object
   */
  private async executeReactProp(
    locator: Locator,
    propName: string,
    mockEventHandle: JSHandle,
  ): Promise<void> {
    await locator.evaluate(
      (element, { propName, mockEvent }) => {
        const propsKey = Object.keys(element).find((key) =>
          key.startsWith('__reactProps$'),
        );
        if (!propsKey) {
          throw new Error('Could not find React props on the target element.');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const func = (element as any)[propsKey][propName];
        if (typeof func !== 'function') {
          throw new Error(`Prop "${propName}" is not a function.`);
        }

        func(mockEvent);
      },
      { propName, mockEvent: mockEventHandle },
    );
  }
}
