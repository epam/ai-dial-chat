import { DialAIEntityModel } from '@/chat/types/models';
import { Styles, Tags } from '@/src/ui/domData';
import { ChatSettingsSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownMenu } from '@/src/ui/webElements/dropdownMenu';
import { Locator, Page } from '@playwright/test';

export class GroupEntities extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsSelectors.groupEntity, parentLocator);
  }

  public versionDropdownMenu!: DropdownMenu;

  getVersionDropdownMenu(): DropdownMenu {
    if (!this.versionDropdownMenu) {
      this.versionDropdownMenu = new DropdownMenu(this.page);
    }
    return this.versionDropdownMenu;
  }

  public entityNames = this.getChildElementBySelector(
    ChatSettingsSelectors.groupEntityName,
  );

  //entity with or without version
  public entityName = (name: string) =>
    new BaseElement(
      this.page,
      `${ChatSettingsSelectors.groupEntityName}:text-is('${name}')`,
    ).getElementLocator();
  //single entity with version
  public ungroupedEntityName = (name: string, version: string) =>
    new BaseElement(
      this.page,
      `${ChatSettingsSelectors.groupEntityName}:text-is('${name} ${version}')`,
    ).getElementLocator();
  //entity version
  public entityVersion = (version: string) =>
    new BaseElement(
      this.page,
      `${ChatSettingsSelectors.groupEntityVersion}:has-text('${version}')`,
    ).getElementLocator();

  public getGroupEntity = (entity: DialAIEntityModel) => {
    let groupEntity;
    //if entity has version in the config
    if (entity.version) {
      groupEntity = this.rootLocator
        .filter({ has: this.entityName(entity.name) })
        .filter({ has: this.entityVersion(entity.version) })
        .first();
    } else {
      //init entity locator if no version is available in the config
      groupEntity = this.rootLocator
        .filter({ has: this.entityName(entity.name) })
        .first();
    }
    return this.createElementFromLocator(groupEntity);
  };

  public async entityWithVersionToSet(entity: DialAIEntityModel) {
    if (entity.version) {
      const entityNameLocator = this.rootLocator.filter({
        has: this.entityName(entity.name),
      });
      if (await entityNameLocator.isVisible()) {
        return entityNameLocator;
      }
    }
  }

  public async selectEntityVersion(entityLocator: Locator, version: string) {
    await entityLocator
      .locator(ChatSettingsSelectors.groupEntityVersion)
      .click();
    await this.getVersionDropdownMenu().selectMenuOption(version, {
      triggeredHttpMethod: 'DELETE',
    });
  }

  public groupEntityDescription = (entity: DialAIEntityModel) =>
    this.getGroupEntity(entity).getChildElementBySelector(
      ChatSettingsSelectors.groupEntityDescr,
    );

  public async getGroupEntityDescription(entity: DialAIEntityModel) {
    const description = this.groupEntityDescription(entity);
    return (await description.isVisible())
      ? description.getElementInnerContent()
      : '';
  }

  public getGroupEntityDescriptionLink = (
    entity: DialAIEntityModel,
    linkText: string,
  ) => {
    return this.createElementFromLocator(
      this.groupEntityDescription(entity).getElementLocatorByText(
        `${Tags.a}:text-is('${linkText}')`,
      ),
    );
  };

  public expandGroupEntity = (entity: DialAIEntityModel) =>
    this.getGroupEntity(entity).getChildElementBySelector(
      ChatSettingsSelectors.expandGroupEntity,
    );

  public async expandGroupEntityDescription(entity: DialAIEntityModel) {
    await this.expandGroupEntity(entity).click();
  }

  public async selectGroupEntity(entity: DialAIEntityModel) {
    await this.getGroupEntity(entity).click();
  }

  public async waitForGroupEntitySelected(entity: DialAIEntityModel) {
    await this.getGroupEntity(entity)
      .getElementLocator()
      .and(
        new BaseElement(
          this.page,
          ChatSettingsSelectors.selectedGroupEntity,
        ).getElementLocator(),
      )
      .waitFor({ state: 'attached' });
  }

  public async getGroupEntityNames() {
    return this.entityNames.getElementsInnerContent();
  }

  public async getEntitiesIcons() {
    return this.getElementIcons(this, ChatSettingsSelectors.groupEntityName);
  }

  public async openGroupEntityDescriptionLink(
    entity: DialAIEntityModel,
    linkText: string,
  ) {
    await this.getGroupEntityDescriptionLink(entity, linkText).click();
  }

  public async getGroupEntityDescriptionLinkColor(
    entity: DialAIEntityModel,
    linkText: string,
  ) {
    return this.getGroupEntityDescriptionLink(
      entity,
      linkText,
    ).getComputedStyleProperty(Styles.textColor);
  }
}
