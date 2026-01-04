import { FilesManagerSelectors } from '@/src/ui/selectors';
import {
  BaseElement,
  FilesManagerCollapsibleSidebar,
  FilesManagerGrid,
  FilesManagerNavigationPanel,
  FilesManagerToolbar,
  Loader,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class FilesManager extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FilesManagerSelectors.container, parentLocator);
  }

  private filesManagerToolbar!: FilesManagerToolbar;
  private filesManagerCollapsibleSidebar!: FilesManagerCollapsibleSidebar;
  private filesManagerNavigationPanel!: FilesManagerNavigationPanel;
  private filesManagerGrid!: FilesManagerGrid;
  private filesManagerLoader!: Loader;

  getFilesManagerToolbar(): FilesManagerToolbar {
    if (!this.filesManagerToolbar) {
      this.filesManagerToolbar = new FilesManagerToolbar(
        this.page,
        this.rootLocator,
      );
    }
    return this.filesManagerToolbar;
  }

  getFilesManagerCollapsibleSidebar(): FilesManagerCollapsibleSidebar {
    if (!this.filesManagerCollapsibleSidebar) {
      this.filesManagerCollapsibleSidebar = new FilesManagerCollapsibleSidebar(
        this.page,
        this.rootLocator,
      );
    }
    return this.filesManagerCollapsibleSidebar;
  }

  getFilesManagerNavigationPanel(): FilesManagerNavigationPanel {
    if (!this.filesManagerNavigationPanel) {
      this.filesManagerNavigationPanel = new FilesManagerNavigationPanel(
        this.page,
        this.rootLocator,
      );
    }
    return this.filesManagerNavigationPanel;
  }

  getFilesManagerGrid(): FilesManagerGrid {
    if (!this.filesManagerGrid) {
      this.filesManagerGrid = new FilesManagerGrid(this.page, this.rootLocator);
    }
    return this.filesManagerGrid;
  }

  getFilesManagerLoader(): Loader {
    if (!this.filesManagerLoader) {
      this.filesManagerLoader = new Loader(this.page, this.rootLocator);
    }
    return this.filesManagerLoader;
  }
}
