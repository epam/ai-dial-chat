import { API, ExpectedConstants } from '@/src/testData';
import { BasePage, ExpectedApiResponse } from '@/src/ui/pages/basePage';
import { FileManagerContainer } from '@/src/ui/webElements/fileManager/fileManagerContainer';

export class FileManagerPage extends BasePage {
  private fileManagerContainer!: FileManagerContainer;

  getFileManagerContainer() {
    if (!this.fileManagerContainer) {
      this.fileManagerContainer = new FileManagerContainer(this.page);
    }
    return this.fileManagerContainer;
  }

  public async openFileManagerPage() {
    const expectedResponses: ExpectedApiResponse[] = [];
    expectedResponses.push({
      apiMethod: 'PUT',
      urlPattern: API.installedDeploymentsHost(),
    });
    expectedResponses.push({
      apiMethod: 'GET',
      urlPattern: API.publishedApplicationsHost(),
    });
    expectedResponses.push({
      apiMethod: 'PUT',
      urlPattern: API.installedToolsetsHost(),
    });
    expectedResponses.push({
      apiMethod: 'GET',
      urlPattern: API.toolsetsHost(),
    });
    expectedResponses.push({
      apiMethod: 'GET',
      urlPattern: API.themeStylesHost,
    });
    expectedResponses.push({
      apiMethod: 'GET',
      urlPattern: API.publishedFiles(),
    });
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
