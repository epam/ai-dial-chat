import { ErrorLabelSelectors, SideBarSelectors } from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { Styles, removeAlpha } from '@/src/ui/domData';
import { ChatLoader } from '@/src/ui/webElements/chatLoader';
import { Search } from '@/src/ui/webElements/search';
import { Locator, Page } from '@playwright/test';

export class SideBar extends BaseElement {
  constructor(page: Page, selector: string) {
    super(page, selector);
  }

  private search!: Search;
  private chatLoader!: ChatLoader;

  getSearch(): Search {
    if (!this.search) {
      this.search = new Search(this.page, this.rootLocator);
    }
    return this.search;
  }

  getChatLoader(): ChatLoader {
    if (!this.chatLoader) {
      this.chatLoader = new ChatLoader(this.page, this.rootLocator);
    }
    return this.chatLoader;
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
  public selectAllButton = this.getChildElementBySelector(
    SideBarSelectors.selectAll,
  );
  public unselectAllButton = this.getChildElementBySelector(
    SideBarSelectors.unselectAll,
  );

  public draggableArea = this.getChildElementBySelector(
    SideBarSelectors.draggableArea,
  );
  public noResultFoundIcon = this.getChildElementBySelector(
    ErrorLabelSelectors.noResultFound,
  );
  public resizeIcon = this.getChildElementBySelector(
    SideBarSelectors.resizeIcon,
  );
  public bottomPanel = this.getChildElementBySelector(
    SideBarSelectors.bottomPanel,
  );

  public foldersSeparator = this.getChildElementBySelector(
    SideBarSelectors.pinnedEntities,
  ).getChildElementBySelector(SideBarSelectors.folderSeparator);

  public async hoverOverNewEntity() {
    await this.newEntityButton.waitForState();
    await this.newEntityButton.hoverOver();
  }

  public async getNewEntityBackgroundColor() {
    const backgroundColor = await this.newEntityButton.getComputedStyleProperty(
      Styles.backgroundColor,
    );
    return removeAlpha(backgroundColor[0]);
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
    const backgroundColor = await this.draggableArea.getComputedStyleProperty(
      Styles.backgroundColor,
    );
    backgroundColor[0] = removeAlpha(backgroundColor[0]);
    return backgroundColor[0];
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

  private async dragAndDropEntityToCoordinates(
    entityLocator: Locator,
    x: number,
    y: number,
    {
      isHttpMethodTriggered = false,
      httpMethod = 'POST',
    }: { isHttpMethodTriggered?: boolean; httpMethod?: string } = {},
  ) {
    await entityLocator.hover();
    await this.page.mouse.down();
    await this.page.mouse.move(x, y);

    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === httpMethod,
      );
      await this.page.mouse.up();
      return respPromise;
    }
    await this.page.mouse.up();
  }

  private async dragAndDropEntityToEntity(
    sourceEntityLocator: Locator,
    targetEntityLocator: Locator,
    options: { isHttpMethodTriggered?: boolean; httpMethod?: string } = {},
  ) {
    const targetBounding = await targetEntityLocator.boundingBox();
    return this.dragAndDropEntityToCoordinates(
      sourceEntityLocator,
      targetBounding!.x + targetBounding!.width / 2,
      targetBounding!.y + targetBounding!.height / 2,
      options,
    );
  }

  public async dragEntityFromFolder(entityLocator: Locator) {
    await entityLocator.hover();
    await this.page.mouse.down();
    const draggableBounding = await this.draggableArea.getElementBoundingBox();
    await this.page.mouse.move(
      draggableBounding!.x + draggableBounding!.width / 2,
      draggableBounding!.y + draggableBounding!.height / 2,
    );
  }

  public async dragAndDropFolderToRoot(
    folderLocator: Locator,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const draggableBounding = await this.foldersSeparator
      .getNthElement(1)
      .boundingBox();
    return this.dragAndDropEntityToCoordinates(
      folderLocator,
      draggableBounding!.x + draggableBounding!.width / 2,
      draggableBounding!.y,
      { isHttpMethodTriggered },
    );
  }

  public async dragAndDropEntityToRoot(
    entityLocator: Locator,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const draggableBounding = await this.foldersSeparator
      .getNthElement(1)
      .boundingBox();
    return this.dragAndDropEntityToCoordinates(
      entityLocator,
      draggableBounding!.x + draggableBounding!.width / 2,
      draggableBounding!.y,
      { isHttpMethodTriggered },
    );
  }

  public async dragEntityToFolder(
    entityLocator: Locator,
    folderLocator: Locator,
  ) {
    await entityLocator.hover();
    await this.page.mouse.down();
    const folderBounding = await folderLocator.boundingBox();
    await this.page.mouse.move(
      folderBounding!.x + folderBounding!.width / 2,
      folderBounding!.y + folderBounding!.height / 2,
    );
  }

  public async dragAndDropEntityFromFolder(
    entityLocator: Locator,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    await this.dragEntityFromFolder(entityLocator);
    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse((resp) => {
        return (
          resp.request().method() === 'PUT' ||
          resp.request().method() === 'POST'
        );
      });
      await this.page.mouse.up();
      return respPromise;
    }
    await this.page.mouse.up();
  }

  public async dragAndDropEntityToFolder(
    entityLocator: Locator,
    folderLocator: Locator,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    return this.dragAndDropEntityToEntity(entityLocator, folderLocator, {
      isHttpMethodTriggered,
      httpMethod: 'POST',
    });
  }
}
