import { Attributes, Tags } from '@/src/ui/domData';
import { FileManagerSidebarSelectors, IconSelectors } from '@/src/ui/selectors';
import { BaseElement, Button, FoldersTree } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class FileManagerCollapsibleSidebar extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FileManagerSidebarSelectors.container, parentLocator);
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

  /**
   * Checks if the sidebar is collapsed.
   * When collapsed, the icon has 'tabler-icon-chevrons-right' class.
   * When expanded, the icon has 'tabler-icon-chevrons-left' class.
   */
  async isCollapsed(): Promise<boolean> {
    const iconLocator = this.getStateButton().getChildElementBySelector(
      Tags.svg,
    );
    const classAttribute = await iconLocator.getAttribute(Attributes.class);
    return (
      classAttribute?.includes(
        IconSelectors.chevronsRightIcon.replace('.', ''),
      ) ?? false
    );
  }

  /**
   * Expands the sidebar if it is currently collapsed.
   */
  async expandIfCollapsed(): Promise<void> {
    if (await this.isCollapsed()) {
      await this.getStateButton().click();
    }
  }

  getFoldersTree(): FoldersTree {
    if (!this.foldersTree) {
      this.foldersTree = new FoldersTree(this.page, this.rootLocator);
    }
    return this.foldersTree;
  }
}
