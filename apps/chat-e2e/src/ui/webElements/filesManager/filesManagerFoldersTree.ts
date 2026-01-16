import { FilesManagerCollapsibleSidebar } from './filesManagerCollapsibleSidebar';

import { FoldersTree } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class FilesManagerFoldersTree extends FoldersTree {
  private sidebar: FilesManagerCollapsibleSidebar;

  constructor(
    page: Page,
    parentLocator: Locator,
    sidebar: FilesManagerCollapsibleSidebar,
  ) {
    super(page, parentLocator);
    this.sidebar = sidebar;
  }

  /**
   * Expands folders by path. Also expands the sidebar if it is collapsed.
   */
  public async expandFoldersWithSidebarHandling(...path: string[]) {
    await this.sidebar.expandIfCollapsed();
    await super.expandFolders(...path);
  }
}
