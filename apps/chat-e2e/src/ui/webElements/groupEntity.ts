import { DialAIEntityModel } from '@/chat/types/models';
import { Styles, Tags } from '@/src/ui/domData';
import { ChatSettingsSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class GroupEntity extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSettingsSelectors.groupEntity, parentLocator);
  }

  public recentEntityNames = this.getChildElementBySelector(
    ChatSettingsSelectors.groupEntityName,
  );

  public groupEntity = (entity: DialAIEntityModel) => {
    let entityName = new BaseElement(
      this.page,
      `${ChatSettingsSelectors.groupEntityName}:text-is('${entity.name}')`,
    ).getElementLocator();
    if (entity.version) {
      //TODO: refactor this method
      if (
        entity.version.match(/^(\d+|\d{4}-\d{2}-\d{2})$/g) &&
        !entity.name.includes('Omni')
      ) {
        entityName = new BaseElement(
          this.page,
          `${ChatSettingsSelectors.groupEntityName}:text-is('${entity.name} ${entity.version}')`,
        ).getElementLocator();
        return this.createElementFromLocator(
          this.rootLocator.filter({ has: entityName }).first(),
        );
      }
      const entityVersion = new BaseElement(
        this.page,
        `${ChatSettingsSelectors.groupEntityVersion}:has-text('${entity.version}')`,
      ).getElementLocator();
      return this.createElementFromLocator(
        this.rootLocator
          .filter({ has: entityName })
          .filter({ has: entityVersion })
          .first(),
      );
    } else {
      return this.createElementFromLocator(
        this.rootLocator.filter({ has: entityName }).first(),
      );
    }
  };

  public groupEntityDescription = (entity: DialAIEntityModel) =>
    this.groupEntity(entity).getChildElementBySelector(
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
    this.groupEntity(entity).getChildElementBySelector(
      ChatSettingsSelectors.expandGroupEntity,
    );

  public async expandGroupEntityDescription(entity: DialAIEntityModel) {
    await this.expandGroupEntity(entity).click();
  }

  public async selectGroupEntity(entity: DialAIEntityModel) {
    await this.groupEntity(entity).click();
  }

  public async waitForGroupEntitySelected(entity: DialAIEntityModel) {
    await this.groupEntity(entity)
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
    return this.recentEntityNames.getElementsInnerContent();
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
