import { FilesManagerFoldersTree } from './filesManagerFoldersTree';

import { FilesManagerSidebarSelectors } from '@/src/ui/selectors';
import { BaseElement, Button } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class FilesManagerCollapsibleSidebar extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FilesManagerSidebarSelectors.container, parentLocator);
  }

  private foldersTree!: FilesManagerFoldersTree;
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

  /**
   * Checks if the sidebar is collapsed.
   * When collapsed, the footer panel has 'justify-center' class.
   * When expanded, the footer panel has 'justify-end' class.
   */
  async isCollapsed(): Promise<boolean> {
    const footerPanel = this.getStateButton().getElementLocator().locator('..');
    const classAttribute = await footerPanel.getAttribute('class');
    return classAttribute?.includes('justify-center') ?? false;
  }

  /**
   * Expands the sidebar if it is currently collapsed.
   */
  async expandIfCollapsed(): Promise<void> {
    if (await this.isCollapsed()) {
      await this.getStateButton().click();
    }
  }

  getFoldersTree(): FilesManagerFoldersTree {
    if (!this.foldersTree) {
      this.foldersTree = new FilesManagerFoldersTree(
        this.page,
        this.rootLocator,
        this,
      );
    }
    return this.foldersTree;
  }
}
