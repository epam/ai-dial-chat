import { API, Import } from '@/e2e/src/testData';
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

  async openHomePage(options?: {
    iconsToBeLoaded?: (string | undefined)[];
    setEntitiesEnvVars?: boolean;
  }) {
    await this.waitFoApiResponsesReceived(
      () => this.navigateToBaseUrl(),
      options,
    );
  }

  async waitFoApiResponsesReceived(
    method: () => Promise<void>,
    options?: {
      iconsToBeLoaded?: (string | undefined)[];
      setEntitiesEnvVars?: boolean;
    },
  ) {
    const responses = [];
    const responseBodies = new Map<string, string>();
    for (const host of [API.modelsHost, API.addonsHost, API.sessionHost]) {
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
            response.url() === iconHost && response.status() === 200,
          { timeout: apiTimeout },
        );
        responses.push(resp);
      }
    }
    await method();
    for (const resp of responses) {
      const resolvedResp = await resp;
      if (options?.setEntitiesEnvVars) {
        const body = await resolvedResp.text();
        const host = resolvedResp.url();
        if (host.includes(API.modelsHost)) {
          responseBodies.set(API.modelsHost, body);
        } else if (host.includes(API.addonsHost)) {
          responseBodies.set(API.addonsHost, body);
        }
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

  async unRouteResponse(url: string) {
    await this.page.unroute(url);
  }

  async reloadPage() {
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getNewPage<T>(method: () => Promise<T>) {
    let newBrowserTab;
    try {
      [newBrowserTab] = await Promise.all([
        this.page.waitForEvent('popup'),
        method(),
      ]);
    } catch (e) {
      console.log('Browser page is not loaded: ' + (e as Error).message);
    }
    await newBrowserTab?.bringToFront();
    return newBrowserTab;
  }

  async acceptBrowserDialog(message: string) {
    await this.page.once('dialog', (dialog) => dialog.accept(message));
  }

  async dismissBrowserDialog() {
    await this.page.once('dialog', (dialog) => dialog.dismiss());
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
