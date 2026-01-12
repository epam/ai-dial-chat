import { API, ExpectedConstants } from '@/src/testData';
import { BasePage, ExpectedApiResponse } from '@/src/ui/pages/basePage';
import { FilesManagerContainer } from '@/src/ui/webElements/filesManager/filesManagerContainer';

export class FilesManagerPage extends BasePage {
  private filesManagerContainer!: FilesManagerContainer;

  getFilesManagerContainer() {
    if (!this.filesManagerContainer) {
      this.filesManagerContainer = new FilesManagerContainer(this.page);
    }
    return this.filesManagerContainer;
  }

  public async openFilesManagerPage() {
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
      () => this.navigateToUrl(ExpectedConstants.filesManagerPath),
      expectedResponses,
    );
  }

  async waitForPageLoaded(options?: { waitForGrid?: boolean }) {
    const waitForGrid = options?.waitForGrid ?? true;
    const filesManagerContainer = this.getFilesManagerContainer();
    const filesManager = filesManagerContainer.getFilesManager();
    await filesManager.waitForState();
    await filesManager
      .getFilesManagerLoader()
      .waitForState({ state: 'hidden' });
    await filesManager.getFilesManagerToolbar().waitForState();
    await filesManager.getFilesManagerNavigationPanel().waitForState();
    await filesManager.getFilesManagerCollapsibleSidebar().waitForState();
    if (waitForGrid) {
      const filesManagerGrid = filesManager.getFilesManagerGrid();
      await filesManagerGrid.waitForState();
      await filesManagerGrid.loader.waitForState({ state: 'hidden' });
    }
  }
}
