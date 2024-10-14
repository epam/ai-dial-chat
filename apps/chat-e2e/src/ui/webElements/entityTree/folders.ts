import {
  ChatBarSelectors,
  EntitySelectors,
  MenuSelectors,
  SideBarSelectors,
} from '../../selectors';
import { BaseElement, elementIndexExceptionError } from '../baseElement';

import { isApiStorageType } from '@/src/hooks/global-setup';
import { API, ExpectedConstants } from '@/src/testData';
import { Attributes, Styles, Tags } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { FolderSelectors } from '@/src/ui/selectors/folderSelectors';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { EditInput } from '@/src/ui/webElements/editInput';
import { EditInputActions } from '@/src/ui/webElements/editInputActions';
import { Locator, Page } from '@playwright/test';

export class Folders extends BaseElement {
  private readonly entitySelector?: string;

  constructor(
    page: Page,
    parentLocator: Locator,
    folderSelector: string,
    entitySelector?: string,
  ) {
    super(page, folderSelector, parentLocator);
    this.entitySelector = entitySelector;
  }

  private editFolderInput!: EditInput;

  getEditFolderInput(): EditInput {
    if (!this.editFolderInput) {
      this.editFolderInput = new EditInput(
        this.page,
        this.getElementLocator(),
        FolderSelectors.folder,
      );
    }
    return this.editFolderInput;
  }

  private editFolderEntityInput!: EditInput;

  getEditFolderEntityInput(): EditInput {
    if (!this.editFolderEntityInput) {
      this.editFolderEntityInput = new EditInput(
        this.page,
        this.getElementLocator(),
        this.entitySelector!,
      );
    }
    return this.editFolderEntityInput;
  }

  private editFolderInputActions!: EditInputActions;

  getEditFolderInputActions(): EditInputActions {
    if (!this.editFolderInputActions) {
      this.editFolderInputActions = new EditInputActions(
        this.page,
        this.getElementLocator(),
        FolderSelectors.folder,
      );
    }
    return this.editFolderInputActions;
  }

  private editFolderEntityInputActions!: EditInputActions;

  getEditFolderEntityInputActions(): EditInputActions {
    if (!this.editFolderEntityInputActions) {
      this.editFolderEntityInputActions = new EditInputActions(
        this.page,
        this.getElementLocator(),
        this.entitySelector!,
      );
    }
    return this.editFolderEntityInputActions;
  }

  private dropdownMenu!: DropdownMenu;

  getDropdownMenu(): DropdownMenu {
    if (!this.dropdownMenu) {
      this.dropdownMenu = new DropdownMenu(this.page);
    }
    return this.dropdownMenu;
  }

  public folderDotsMenu = (name: string, index?: number) => {
    return this.getFolderByName(name, index).locator(MenuSelectors.dotsMenu);
  };

  public getFolderByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      FolderSelectors.folder,
    ).getElementLocatorByText(name, index);
  }

  public getRootFolderByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      FolderSelectors.rootFolder(),
    ).getElementLocatorByText(name, index);
  }

  public getChildFolderByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      FolderSelectors.childFolder(),
    ).getElementLocatorByText(name, index);
  }

  public getFolderBackgroundColor(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getFolderByName(name, index),
    ).getComputedStyleProperty(Styles.backgroundColor);
  }

  public getFolderName(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getFolderByName(name, index).locator(FolderSelectors.folderName),
    );
  }

  public getFolderCheckbox(name: string, index?: number) {
    return this.getFolderByName(name, index).getByRole('checkbox');
  }

  public async getFolderNames() {
    return this.getChildElementBySelector(
      FolderSelectors.folder,
    ).getElementsInnerContent();
  }

  public async getFolderCheckboxState(name: string, index?: number) {
    return this.getFolderCheckbox(name, index).getAttribute(Attributes.dataQA);
  }

  public async getFolderCheckboxBorderColors(
    folderName: string,
    index?: number,
  ) {
    return this.createElementFromLocator(
      this.getFolderCheckbox(folderName, index),
    ).getAllBorderColors();
  }

  public async getFolderCheckboxColor(folderName: string, index?: number) {
    return this.createElementFromLocator(
      this.getFolderCheckbox(folderName, index),
    ).getComputedStyleProperty(Styles.color);
  }

  public getFolderExpandIcon(name: string, index?: number) {
    return this.getFolderByName(name, index).locator(
      `${Tags.span}[class='${Attributes.visible}']`,
    );
  }

  public async isFolderCaretExpanded(name: string, index?: number) {
    return this.getFolderExpandIcon(name, index)
      .locator(`.${Attributes.rotated90}`)
      .isVisible();
  }

  public foldersGroup = (parentFolderName: string) => {
    return this.createElementFromLocator(
      this.getChildElementBySelector(
        FolderSelectors.folderGroup,
      ).getElementLocatorByText(parentFolderName),
    );
  };

  public async waitForFolderGroupIsHighlighted(parentFolderName: string) {
    await this.getChildElementBySelector(
      `${FolderSelectors.folderGroup}.${ExpectedConstants.backgroundAccentAttribute}`,
    )
      .getElementLocatorByText(parentFolderName)
      .waitFor({ state: 'attached' });
  }

  public async getFoldersCount() {
    return this.getChildElementBySelector(
      FolderSelectors.folder,
    ).getElementsCount();
  }

  public async openFolderDropdownMenu(name: string, index?: number) {
    const folderDotsMenu = await this.getFolderDropdownMenu(name, index);
    await folderDotsMenu.click();
    await this.getDropdownMenu().waitForState();
  }

  public async getFolderDropdownMenu(name: string, index?: number) {
    const folderToEdit = this.getFolderByName(name, index);
    await folderToEdit.hover();
    return this.folderDotsMenu(name, index);
  }

  public async editFolderNameWithEnter(newName: string) {
    await this.editFolderName(newName);
    await this.page.keyboard.press(keys.enter);
  }

  public async editFolderNameWithTick(
    newName: string,
    { isHttpMethodTriggered = true }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    await this.editFolderName(newName);
    const folderInputActions = this.getEditFolderInputActions();
    if (isHttpMethodTriggered && isApiStorageType) {
      const respPromise = this.page.waitForResponse((resp) => {
        return (
          resp.url().includes(API.conversationsHost()) ||
          resp.url().includes(API.promptsHost())
        );
      });
      await folderInputActions.clickTickButton();
      return respPromise;
    }
    await folderInputActions.clickTickButton();
  }

  public async editFolderName(newName: string) {
    const folderInput = this.getEditFolderInput();
    await folderInput.editValue(newName);
    return folderInput;
  }

  public getFolderInEditMode(name: string) {
    const folderInEditModeLocator = this.getChildElementBySelector(
      FolderSelectors.folder,
    )
      .getElementLocator()
      .filter({
        has: this.page.locator(`[${Attributes.value}="${name}"]`),
      });
    return this.createElementFromLocator(folderInEditModeLocator);
  }

  public async expandFolder(
    name: string,
    options?: { isHttpMethodTriggered?: boolean; httpHost?: string },
    index?: number,
  ) {
    const isFolderExpanded = await this.isFolderCaretExpanded(name, index);
    if (!isFolderExpanded) {
      await this.expandCollapseFolder(name, options, index);
    }
  }

  public async expandCollapseFolder(
    name: string,
    options: { isHttpMethodTriggered?: boolean; httpHost?: string } = {},
    index?: number,
  ) {
    const mergedOptions = {
      isHttpMethodTriggered: false,
      httpHost: API.listingHost,
      ...options,
    };
    const folder = this.getFolderByName(name, index);
    await folder.waitFor();
    if (isApiStorageType && mergedOptions.isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse((resp) =>
        resp.url().includes(mergedOptions.httpHost!),
      );
      await this.getFolderExpandIcon(name, index).click();
      return respPromise;
    }
    await folder.click();
  }

  public async getFolderNameColor(name: string, index?: number) {
    const folder = this.createElementFromLocator(
      this.getFolderByName(name, index).getByText(name),
    );
    return folder.getComputedStyleProperty(Styles.color);
  }

  public getNestedFolder(
    parentName: string,
    childName: string,
    parentIndex?: number,
  ) {
    return this.getFolderByName(parentName, parentIndex)
      .locator('~*')
      .locator(FolderSelectors.folder)
      .filter({ hasText: childName });
  }

  public getFolderEntities(name: string, index?: number) {
    return this.getFolderByName(name, index).locator(
      `~${Tags.div} ${this.entitySelector}`,
    );
  }

  public getFolderEntity(
    folderName: string,
    entityName: string,
    folderIndex?: number,
    entityIndex?: number,
  ) {
    if (entityIndex === 0) {
      throw new Error(elementIndexExceptionError);
    }
    return this.getFolderEntities(folderName, folderIndex)
      .filter({
        hasText: entityName,
      })
      .nth(entityIndex ? entityIndex - 1 : 0);
  }

  public folderEntityDotsMenu = (folderName: string, entityName: string) => {
    return this.getFolderEntity(folderName, entityName).locator(
      MenuSelectors.dotsMenu,
    );
  };

  public getFolderEntitiesCount(folderName: string) {
    return this.getFolderEntities(folderName).count();
  }

  public async isFolderEntityVisible(folderName: string, entityName: string) {
    return this.getFolderEntity(folderName, entityName).isVisible();
  }

  public getSelectedFolderEntity(folderName: string, entityName: string) {
    return this.getFolderEntity(folderName, entityName).locator(
      ChatBarSelectors.selectedEntity,
    );
  }

  public async selectFolderEntity(
    folderName: string,
    entityName: string,
    { isHttpMethodTriggered = false }: { isHttpMethodTriggered?: boolean } = {},
  ) {
    const folderEntity = this.getFolderEntity(folderName, entityName);
    if (isApiStorageType && isHttpMethodTriggered) {
      const respPromise = this.page.waitForResponse(
        (resp) => resp.request().method() === 'GET',
      );
      await folderEntity.click();
      return respPromise;
    }
    await folderEntity.click();
  }

  public async openFolderEntityDropdownMenu(
    folderName: string,
    entityName: string,
  ) {
    const folderEntity = this.getFolderEntity(folderName, entityName);
    await folderEntity.waitFor({
      state: 'attached',
    });
    await folderEntity.hover();
    await this.folderEntityDotsMenu(folderName, entityName).click();
    await this.getDropdownMenu().waitForState();
  }

  public getFolderArrowIcon(name: string, index?: number) {
    return this.getFolderByName(name, index).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  public async getFolderArrowIconColor(name: string, index?: number) {
    const iconElement = this.createElementFromLocator(
      this.getFolderArrowIcon(name, index).locator(Tags.svg),
    );
    return iconElement.getComputedStyleProperty(Styles.color);
  }

  public async getFolderEntityBackgroundColor(
    folderName: string,
    entityName: string,
    index?: number,
  ) {
    return this.createElementFromLocator(
      this.getFolderEntity(folderName, entityName, index),
    ).getComputedStyleProperty(Styles.backgroundColor);
  }

  public async getFolderEntityColor(
    folderName: string,
    entityName: string,
    folderIndex?: number,
    entityIndex?: number,
  ) {
    const folderEntityColor = await this.createElementFromLocator(
      this.getFolderEntity(
        folderName,
        entityName,
        folderIndex,
        entityIndex,
      ).locator(EntitySelectors.entityName),
    ).getComputedStyleProperty(Styles.color);
    return folderEntityColor[0];
  }

  public getFolderEntityArrowIcon(
    folderName: string,
    entityName: string,
    folderIndex?: number,
    entityIndex?: number,
  ) {
    return this.getFolderEntity(
      folderName,
      entityName,
      folderIndex,
      entityIndex,
    ).locator(SideBarSelectors.arrowAdditionalIcon);
  }

  public async getFolderEntityArrowIconColor(
    folderName: string,
    entityName: string,
    index?: number,
  ) {
    return this.createElementFromLocator(
      this.getFolderEntityArrowIcon(folderName, entityName, index),
    )
      .getChildElementBySelector(Tags.svg)
      .getComputedStyleProperty(Styles.color);
  }

  public getFolderEntityCheckbox(
    folderName: string,
    entityName: string,
    folderIndex?: number,
    entityIndex?: number,
  ) {
    return this.getFolderEntity(
      folderName,
      entityName,
      folderIndex,
      entityIndex,
    ).getByRole('checkbox');
  }

  public async getFolderEntityCheckboxState(
    folderName: string,
    entityName: string,
    folderIndex?: number,
    entityIndex?: number,
  ) {
    return this.getFolderEntityCheckbox(
      folderName,
      entityName,
      folderIndex,
      entityIndex,
    ).getAttribute(Attributes.dataQA);
  }

  public async getFolderEntityCheckboxColor(
    folderName: string,
    entityName: string,
    index?: number,
  ) {
    return this.createElementFromLocator(
      this.getFolderEntityCheckbox(folderName, entityName, index),
    ).getComputedStyleProperty(Styles.color);
  }

  public async getFolderEntityCheckboxBorderColors(
    folderName: string,
    entityName: string,
    index?: number,
  ) {
    return this.createElementFromLocator(
      this.getFolderEntityCheckbox(folderName, entityName, index),
    ).getAllBorderColors();
  }
}
