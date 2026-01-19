import { API, FilesManagerToolbarTabs } from '@/src/testData';
import { FilesManagerSelectors } from '@/src/ui/selectors';
import {
  BaseElement,
  Button,
  Dropdown,
  Switcher,
  Tab,
} from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class FilesManagerToolbar extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, FilesManagerSelectors.toolbarContainer, parentLocator);
  }

  private toolbarTabs!: Tab;
  private toolbarSwitcher!: Switcher;
  private newButton!: Button;
  private newButtonDropdownMenu!: Dropdown;
  private downloadButton!: Button;
  private moveToButton!: Button;
  private copyToButton!: Button;
  private duplicateButton!: Button;
  private deleteButton!: Button;
  private selectedIconsButton!: Button;

  getToolbarTabs(): Tab {
    if (!this.toolbarTabs) {
      this.toolbarTabs = new Tab(this.page, this.rootLocator);
    }
    return this.toolbarTabs;
  }

  getToolbarSwitcher(): Switcher {
    if (!this.toolbarSwitcher) {
      this.toolbarSwitcher = new Switcher(this.page, this.rootLocator);
    }
    return this.toolbarSwitcher;
  }

  getNewButton(): Button {
    if (!this.newButton) {
      this.newButton = new Button(this.page, 'New', this.rootLocator);
    }
    return this.newButton;
  }

  getNewButtonDropdownMenu(): Dropdown {
    if (!this.newButtonDropdownMenu) {
      this.newButtonDropdownMenu = new Dropdown(this.page);
    }
    return this.newButtonDropdownMenu;
  }

  getDownloadButton(): Button {
    if (!this.downloadButton) {
      this.downloadButton = new Button(this.page, 'Download', this.rootLocator);
    }
    return this.downloadButton;
  }

  getMoveToButton(): Button {
    if (!this.moveToButton) {
      this.moveToButton = new Button(this.page, 'Move to', this.rootLocator);
    }
    return this.moveToButton;
  }

  getCopyToButton(): Button {
    if (!this.copyToButton) {
      this.copyToButton = new Button(this.page, 'Copy to', this.rootLocator);
    }
    return this.copyToButton;
  }

  getDuplicateButton(): Button {
    if (!this.duplicateButton) {
      this.duplicateButton = new Button(
        this.page,
        'Duplicate',
        this.rootLocator,
      );
    }
    return this.duplicateButton;
  }

  getDeleteButton(): Button {
    if (!this.deleteButton) {
      this.deleteButton = new Button(this.page, 'Delete', this.rootLocator);
    }
    return this.deleteButton;
  }

  getSelectedIconsButton(count: number): Button {
    const ariaLabel =
      count === 1 ? `${count} item selected` : `${count} items selected`;
    this.selectedIconsButton = new Button(
      this.page,
      ariaLabel,
      this.rootLocator,
    );
    return this.selectedIconsButton;
  }

  public async clickDownloadButton(): Promise<void> {
    const respPromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes(API.downloadFilesHost()) &&
        resp.request().method() === 'POST' &&
        resp.ok(),
    );
    await this.downloadButton.click();
    await respPromise;
  }

  public myFilesTab = this.getToolbarTabs().tabByName(
    FilesManagerToolbarTabs.MyFiles,
  );

  public organizationTab = this.getToolbarTabs().tabByName(
    FilesManagerToolbarTabs.Organization,
  );
}
