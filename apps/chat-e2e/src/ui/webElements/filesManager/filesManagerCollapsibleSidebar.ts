import { FilesManagerSidebarSelectors } from '@/src/ui/selectors';
import { BaseElement, Button, FoldersTree } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';


export class FilesManagerCollapsibleSidebar extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FilesManagerSidebarSelectors.container, parentLocator);
  }

  private foldersTree!: FoldersTree;
  private collapseAllButton!: Button;
  private stateButton!: Button;

  getCollapseAllButton(): Button {
    if (!this.collapseAllButton) {
      this.collapseAllButton = new Button(
        this.page,
        'collapse-all',
        this.rootLocator,
      );
    }
    return this.collapseAllButton;
  }

  getStateButton(): Button {
    if (!this.stateButton) {
      this.stateButton = new Button(
        this.page,
        'sidebar-state',
        this.rootLocator,
      );
    }
    return this.stateButton;
  }

  getFoldersTree(): FoldersTree {
    if (!this.foldersTree) {
      this.foldersTree = new FoldersTree(this.page, this.rootLocator);
    }
    return this.foldersTree;
  }
}
