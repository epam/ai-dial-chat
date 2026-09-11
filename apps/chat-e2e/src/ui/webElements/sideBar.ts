import {
  ErrorLabelSelectors,
  MenuSelectors,
  SideBarSelectors,
} from '../selectors';
import { BaseElement } from './baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { MenuOptions } from '@/src/testData';
import { Styles, removeAlpha } from '@/src/ui/domData';
import { ChatLoader } from '@/src/ui/webElements/chatLoader';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { SidebarSearch } from '@/src/ui/webElements/sidebarSearch';
import { Locator, Page } from '@playwright/test';

export class SideBar extends BaseElement {
  constructor(page: Page, selector: string, parentLocator: Locator) {
    super(page, selector, parentLocator);
  }

  private sidebarSearch!: SidebarSearch;
  private chatLoader!: ChatLoader;
  private bottomDropdownMenu!: DropdownMenu;

  getSidebarSearch(): SidebarSearch {
    if (!this.sidebarSearch) {
      this.sidebarSearch = new SidebarSearch(this.page, this.rootLocator);
    }
    return this.sidebarSearch;
  }

  getChatLoader(): ChatLoader {
    if (!this.chatLoader) {
      this.chatLoader = new ChatLoader(this.page, this.rootLocator);
    }
    return this.chatLoader;
  }

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

  public newEntityButton = this.getChildElementBySelector(
    SideBarSelectors.newEntity,
  );

  public bottomDotsMenuIcon = this.bottomPanel.getChildElementBySelector(
    MenuSelectors.dotsMenu,
  );

  getBottomDropdownMenu(): DropdownMenu {
    if (!this.bottomDropdownMenu) {
      this.bottomDropdownMenu = new DropdownMenu(this.page);
    }
    return this.bottomDropdownMenu;
  }

  public async createNewEntity() {
    await this.newEntityButton.click();
  }

  public async createNewFolder() {
    await this.newFolderButton.click();
  }

  public async deleteAllEntities() {
    try {
      await this.deleteEntitiesButton.click({ force: true });
    } catch {
      await this.bottomDotsMenuIcon.click();
      await this.getBottomDropdownMenu().selectMenuOption(MenuOptions.delete);
    }
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

  /**
   * Dragging a folder unconditionally collapses it (see Folder.tsx's
   * onDragStart -> UIActions.closeFolder), which unmounts any of its nested
   * descendants. A real mouse-based drag (dragTo/dragAndDropEntityToFolder)
   * resolves the target's screen position once and clicks there later, so
   * dragging a folder onto its own descendant always races that collapse
   * and lands on whatever unrelated row slides into the vacated position.
   * This dispatches the whole HTML5 drag sequence synchronously in one
   * script instead of simulating real mouse movement, so the target is
   * still mounted when "drop" fires - before React can commit the
   * collapse triggered by "dragstart".
   */
  public async instantDragAndDropFolder(source: Locator, target: Locator) {
    const sourceHandle = await source.elementHandle();
    const targetHandle = await target.elementHandle();
    await this.page.evaluate(
      ([src, tgt]) => {
        const dataTransfer = new DataTransfer();
        const fire = (el: Element, type: string) =>
          el.dispatchEvent(
            new DragEvent(type, {
              bubbles: true,
              cancelable: true,
              dataTransfer,
            }),
          );
        fire(src as Element, 'dragstart');
        fire(tgt as Element, 'dragenter');
        fire(tgt as Element, 'dragover');
        fire(tgt as Element, 'drop');
        fire(src as Element, 'dragend');
      },
      [sourceHandle, targetHandle],
    );
  }

  public noDataIcon = this.getChildElementBySelector(
    SideBarSelectors.noDataIcon,
  );

  public noDataPlaceholder = this.getChildElementBySelector(
    SideBarSelectors.noData,
  );

  public closeButton = this.getChildElementBySelector(
    SideBarSelectors.closeSidebar,
  );
}
