import { ChatSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { ExpectedConstants } from '@/e2e/src/testData';
import { Styles } from '@/e2e/src/ui/domData';
import { Page } from '@playwright/test';

export class SideBar extends BaseElement {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  public newEntityButton = this.getChildElementBySelector(
    SideBarSelectors.newEntity,
  );
  public newFolderButton = this.getChildElementBySelector(
    SideBarSelectors.newFolder,
  );
  public importButton = this.getChildElementBySelector(SideBarSelectors.import);
  public exportButton = this.getChildElementBySelector(SideBarSelectors.export);
  public deleteEntitiesButton = this.getChildElementBySelector(
    SideBarSelectors.deleteEntities,
  );

  public draggableArea = this.getChildElementBySelector(
    SideBarSelectors.draggableArea,
  );
  public noResultFoundIcon = this.getChildElementBySelector(
    ChatSelectors.noResultFound,
  );
  public resizeIcon = this.getChildElementBySelector(
    SideBarSelectors.resizeIcon,
  );
  public bottomPanel = this.getChildElementBySelector(
    SideBarSelectors.bottomPanel,
  );

  public async hoverOverNewEntity() {
    await this.newEntityButton.waitForState();
    await this.newEntityButton.hoverOver();
  }

  public async getNewEntityBackgroundColor() {
    const backgroundColor = await this.newEntityButton.getComputedStyleProperty(
      Styles.backgroundColor,
    );
    backgroundColor[0] = backgroundColor[0].replace(
      ExpectedConstants.backgroundColorPattern,
      '$1)',
    );
    return backgroundColor[0];
  }

  public async getNewEntityCursor() {
    return this.newEntityButton.getComputedStyleProperty(Styles.cursor);
  }

  public async createNewFolder() {
    await this.newFolderButton.click();
  }

  public async deleteAllEntities() {
    await this.deleteEntitiesButton.click();
  }

  public async getDraggableAreaColor() {
    return this.draggableArea.getComputedStyleProperty(Styles.backgroundColor);
  }

  public async resizePanelWidth(xOffset: number) {
    const resizeIconBounding = await this.resizeIcon.getElementBoundingBox();
    await this.page.mouse.move(
      resizeIconBounding!.x + resizeIconBounding!.width,
      resizeIconBounding!.height / 2,
    );
    await this.page.mouse.down();
    await this.page.mouse.move(xOffset, resizeIconBounding!.height / 2);
    await this.page.mouse.up();
  }
}
