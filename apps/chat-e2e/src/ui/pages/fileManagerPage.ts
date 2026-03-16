import { API, ExpectedConstants } from '@/src/testData';
import { BasePage, ExpectedApiResponse } from '@/src/ui/pages/basePage';
import { FileManagerContainer } from '@/src/ui/webElements/fileManager/fileManagerContainer';

interface FileManagerPageOptions {
  updateInstalledDeployments?: boolean;
  getInstalledDeployments?: boolean;
  getPublishedApplications?: boolean;
  updateInstalledToolsets?: boolean;
  getInstalledToolsets?: boolean;
  getPublishedFiles?: boolean;
  getToolsets?: boolean;
  getStyles?: boolean;
}

const DEFAULT_FILE_MANAGER_OPTIONS: FileManagerPageOptions = {
  updateInstalledDeployments: true,
  getInstalledDeployments: false,
  getPublishedApplications: true,
  updateInstalledToolsets: true,
  getInstalledToolsets: false,
  getPublishedFiles: true,
  getToolsets: true,
  getStyles: true,
};

export class FileManagerPage extends BasePage {
  private fileManagerContainer!: FileManagerContainer;

  getFileManagerContainer() {
    if (!this.fileManagerContainer) {
      this.fileManagerContainer = new FileManagerContainer(this.page);
    }
    return this.fileManagerContainer;
  }

  public async openFileManagerPage(
    options: Partial<FileManagerPageOptions> = {},
  ) {
    const mergedOptions = { ...DEFAULT_FILE_MANAGER_OPTIONS, ...options };
    const expectedResponses: ExpectedApiResponse[] = [];
    if (mergedOptions.updateInstalledDeployments) {
      expectedResponses.push({
        apiMethod: 'PUT',
        urlPattern: API.installedDeploymentsHost(),
      });
    }
    if (mergedOptions.getInstalledDeployments) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.installedDeploymentsHost(),
      });
    }
    if (mergedOptions.updateInstalledToolsets) {
      expectedResponses.push({
        apiMethod: 'PUT',
        urlPattern: API.installedToolsetsHost(),
      });
    }
    if (mergedOptions.getInstalledToolsets) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.installedToolsetsHost(),
      });
    }
    if (mergedOptions.getPublishedApplications) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.publishedApplicationsHost(),
      });
    }
    if (mergedOptions.getPublishedFiles) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.publishedFiles(),
      });
    }
    if (mergedOptions.getToolsets) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.toolsetsHost(),
      });
    }
    if (mergedOptions.getStyles) {
      expectedResponses.push({
        apiMethod: 'GET',
        urlPattern: API.themeStylesHost,
      });
    }
    await this.waitForExpectedResponses(
      () => this.navigateToUrl(ExpectedConstants.fileManagerPath),
      expectedResponses,
    );
  }

  async waitForPageLoaded({
    isGridVisible = true,
  }: { isGridVisible?: boolean } = {}) {
    const fileManagerContainer = this.getFileManagerContainer();
    const fileManager = fileManagerContainer.getFileManager();
    await fileManager.waitForState();
    await fileManager.getFileManagerLoader().waitForState({ state: 'hidden' });
    await fileManager.getFileManagerToolbar().waitForState();
    await fileManager.getFileManagerNavigationPanel().waitForState();
    await fileManager.getFileManagerCollapsibleSidebar().waitForState();
    if (isGridVisible) {
      const fileManagerGrid = fileManager.getFileManagerGrid();
      await fileManagerGrid.waitForState();
      await fileManagerGrid.loader.waitForState({ state: 'hidden' });
    } else {
      await fileManager.getNoDataContent().waitForState();
    }
  }
}
