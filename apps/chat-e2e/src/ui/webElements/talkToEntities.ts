import { DialAIEntityModel } from '@/chat/types/models';
import { Styles, Tags } from '@/src/ui/domData';
import { ChatSettingsSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { DropdownButtonMenu } from '@/src/ui/webElements/dropdownButtonMenu';
import { Locator, Page } from '@playwright/test';

export class TalkToEntities extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsSelectors.talkToEntity, parentLocator);
  }

  public versionDropdownMenu!: DropdownButtonMenu;

  getVersionDropdownMenu(): DropdownButtonMenu {
    if (!this.versionDropdownMenu) {
      this.versionDropdownMenu = new DropdownButtonMenu(this.page);
    }
    return this.versionDropdownMenu;
  }

  public entityNames = this.getChildElementBySelector(
    ChatSettingsSelectors.talkToEntityName,
  );

  //entity with or without version
  public entityName = (name: string) =>
    new BaseElement(
      this.page,
      `${ChatSettingsSelectors.talkToEntityName}:text-is('${name}')`,
    ).getElementLocator();
  //entity version
  public entityVersion = (version: string) =>
    new BaseElement(
      this.page,
      `${ChatSettingsSelectors.talkToEntityVersion}:text-is('${version}')`,
    ).getElementLocator();

  public getTalkToEntity = (entity: DialAIEntityModel) => {
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
    let isVersionSelected = false;
    const menuTrigger = entityLocator.locator(
      ChatSettingsSelectors.talkToEntityVersionMenuTrigger,
    );
    //check if version menu is available
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();
      const menuVersion = this.getVersionDropdownMenu().menuOption(version);
      //check if menu contains version
      if (await menuVersion.isVisible()) {
        await this.getVersionDropdownMenu().selectMenuOption(version);
        isVersionSelected = true;
      }
    }
    return isVersionSelected;
  }

  public talkToEntityDescription = (entity: DialAIEntityModel) =>
    this.getTalkToEntity(entity).getChildElementBySelector(
      ChatSettingsSelectors.talkToEntityDescr,
    );

  public async getTalkToEntityDescription(entity: DialAIEntityModel) {
    const description = this.talkToEntityDescription(entity);
    return (await description.isVisible())
      ? description.getElementInnerContent()
      : '';
  }

  public getTalkToEntityDescriptionLink = (
    entity: DialAIEntityModel,
    linkText: string,
  ) => {
    return this.createElementFromLocator(
      this.talkToEntityDescription(entity).getElementLocatorByText(
        `${Tags.a}:text-is('${linkText}')`,
      ),
    );
  };

  public expandTalkToEntity = (entity: DialAIEntityModel) =>
    this.getTalkToEntity(entity).getChildElementBySelector(
      ChatSettingsSelectors.expandTalkToEntity,
    );

  public async expandTalkToEntityDescription(entity: DialAIEntityModel) {
    await this.expandTalkToEntity(entity).click();
  }

  public async selectTalkToEntity(entity: DialAIEntityModel) {
    await this.getTalkToEntity(entity).click();
  }

  public async waitForTalkToEntitySelected(entity: DialAIEntityModel) {
    await this.getTalkToEntity(entity)
      .getElementLocator()
      .and(
        new BaseElement(
          this.page,
          ChatSettingsSelectors.selectedTalkToEntity,
        ).getElementLocator(),
      )
      .waitFor({ state: 'attached' });
  }

  public async getTalkToEntityNames() {
    return this.entityNames.getElementsInnerContent();
  }

  public async getEntitiesIcons() {
    return this.getElementIcons(this);
  }

  public async openTalkToEntityDescriptionLink(
    entity: DialAIEntityModel,
    linkText: string,
  ) {
    await this.getTalkToEntityDescriptionLink(entity, linkText).click();
  }

  public async getTalkToEntityDescriptionLinkColor(
    entity: DialAIEntityModel,
    linkText: string,
  ) {
    return this.getTalkToEntityDescriptionLink(
      entity,
      linkText,
    ).getComputedStyleProperty(Styles.textColor);
  }
}
