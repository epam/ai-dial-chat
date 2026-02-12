import { FileManagerSelectors } from '@/src/ui/selectors';
import {
  BaseElement,
  FileManagerCollapsibleSidebar,
  FileManagerGrid,
  FileManagerNavigationPanel,
  FileManagerToolbar,
  Loader,
  NoDataContent,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class FileManager extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FileManagerSelectors.container, parentLocator);
  }

  private fileManagerToolbar!: FileManagerToolbar;
  private fileManagerCollapsibleSidebar!: FileManagerCollapsibleSidebar;
  private fileManagerNavigationPanel!: FileManagerNavigationPanel;
  private fileManagerGrid!: FileManagerGrid;
  private fileManagerLoader!: Loader;
  private noDataContent!: NoDataContent;

  getFileManagerToolbar(): FileManagerToolbar {
    if (!this.fileManagerToolbar) {
      this.fileManagerToolbar = new FileManagerToolbar(
        this.page,
        this.rootLocator,
      );
    }
    return this.fileManagerToolbar;
  }

  getFileManagerCollapsibleSidebar(): FileManagerCollapsibleSidebar {
    if (!this.fileManagerCollapsibleSidebar) {
      this.fileManagerCollapsibleSidebar = new FileManagerCollapsibleSidebar(
        this.page,
        this.rootLocator,
      );
    }
    return this.fileManagerCollapsibleSidebar;
  }

  getFileManagerNavigationPanel(): FileManagerNavigationPanel {
    if (!this.fileManagerNavigationPanel) {
      this.fileManagerNavigationPanel = new FileManagerNavigationPanel(
        this.page,
        this.rootLocator,
      );
    }
    return this.fileManagerNavigationPanel;
  }

  getFileManagerGrid(): FileManagerGrid {
    if (!this.fileManagerGrid) {
      this.fileManagerGrid = new FileManagerGrid(this.page, this.rootLocator);
    }
    return this.fileManagerGrid;
  }

  getFileManagerLoader(): Loader {
    if (!this.fileManagerLoader) {
      this.fileManagerLoader = new Loader(this.page, this.rootLocator);
    }
    return this.fileManagerLoader;
  }

  getNoDataContent(): NoDataContent {
    if (!this.noDataContent) {
      this.noDataContent = new NoDataContent(this.page, this.rootLocator);
    }
    return this.noDataContent;
  }
}
