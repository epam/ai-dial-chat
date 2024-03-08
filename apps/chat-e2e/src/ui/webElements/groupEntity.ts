import { Styles, Tags } from '@/src/ui/domData';
import { ChatSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements/baseElement';
import { Locator, Page } from '@playwright/test';

export class GroupEntity extends BaseElement {
  constructor(page: Page, parentLocator: Locator) {
    super(page, ChatSelectors.groupEntity, parentLocator);
  }

  public recentEntityNames = this.getChildElementBySelector(
    ChatSelectors.groupEntityName,
  );

  public groupEntity = (entity: string) => {
    const entityName = new BaseElement(
      this.page,
      `${ChatSelectors.groupEntityName}:text-is('${entity}')`,
    ).getElementLocator();
    return this.createElementFromLocator(
      this.rootLocator.filter({ has: entityName }),
    );
  };

  public groupEntityDescription = (entity: string) =>
    this.groupEntity(entity).getChildElementBySelector(
      ChatSelectors.groupEntityDescr,
    );

  public async getGroupEntityDescription(entity: string) {
    const description = this.groupEntityDescription(entity);
    return (await description.isVisible())
      ? description.getElementInnerContent()
      : '';
  }

  public getGroupEntityDescriptionLink = (entity: string, linkText: string) => {
    return this.createElementFromLocator(
      this.groupEntityDescription(entity).getElementLocatorByText(
        `${Tags.a}:text-is('${linkText}')`,
      ),
    );
  };

  public expandGroupEntity = (entity: string) =>
    this.groupEntity(entity).getChildElementBySelector(
      ChatSelectors.expandGroupEntity,
    );

  public async expandGroupEntityDescription(entity: string) {
    await this.expandGroupEntity(entity).click();
  }

  public async selectGroupEntity(entity: string) {
    await this.groupEntity(entity).click();
  }

  public async waitForGroupEntitySelected(entity: string) {
    await this.groupEntity(entity)
      .getElementLocator()
      .and(
        new BaseElement(
          this.page,
          ChatSelectors.selectedGroupEntity,
        ).getElementLocator(),
      )
      .waitFor({ state: 'attached' });
  }

  public async getGroupEntityNames() {
    return this.recentEntityNames.getElementsInnerContent();
  }

  public async getEntitiesIcons() {
    return this.getElementIcons(this, ChatSelectors.groupEntityName);
  }

  public async openGroupEntityDescriptionLink(
    entity: string,
    linkText: string,
  ) {
    await this.getGroupEntityDescriptionLink(entity, linkText).click();
  }

  public async getGroupEntityDescriptionLinkColor(
    entity: string,
    linkText: string,
  ) {
    return this.getGroupEntityDescriptionLink(
      entity,
      linkText,
    ).getComputedStyleProperty(Styles.textColor);
  }
}
