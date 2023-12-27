import { ChatSelectors, ModelDialog } from '../selectors';
import { BaseElement, EntityIcon } from './baseElement';

import { Groups } from '@/e2e/src/testData';
import { Styles, Tags } from '@/e2e/src/ui/domData';
import { Page } from '@playwright/test';

export class ModelsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ModelDialog.modelDialog);
  }

  public searchInput = this.getChildElementBySelector(ModelDialog.searchInput);

  public group = (group: Groups) =>
    this.getChildElementBySelector(
      ModelDialog.talkToGroup,
    ).getElementLocatorByText(group);

  public groupEntity = this.getChildElementBySelector(ModelDialog.groupEntity);
  public closeButton = this.getChildElementBySelector(ModelDialog.closeDialog);
  public noResultFoundIcon = this.getChildElementBySelector(
    ChatSelectors.noResultFound,
  );
  public modelsTab = this.getChildElementBySelector(ModelDialog.modelsTab);
  public assistantsTab = this.getChildElementBySelector(
    ModelDialog.assistantsTab,
  );
  public applicationsTab = this.getChildElementBySelector(
    ModelDialog.applicationsTab,
  );

  public entityOptionByGroup = (group: Groups, option: string) =>
    this.group(group).locator(
      `${ModelDialog.groupEntity}:has(${ModelDialog.groupEntityName}:text-is('${option}'))`,
    );

  public entityOptionDescription = (group: Groups, option: string) => {
    return this.entityOptionByGroup(group, option).locator(
      ModelDialog.groupEntityDescr,
    );
  };

  public entityOptionDescriptionLink = (
    group: Groups,
    option: string,
    linkText: string,
  ) => {
    return this.createElementFromLocator(
      this.entityOptionDescription(group, option).locator(
        `${Tags.a}:text-is('${linkText}')`,
      ),
    );
  };

  public expandIcon = (group: Groups, option: string) =>
    this.entityOptionByGroup(group, option).locator(
      ModelDialog.expandGroupEntity,
    );

  public async getEntityOptionDescription(group: Groups, option: string) {
    const entityDescription = this.entityOptionDescription(group, option);
    return (await entityDescription.isVisible())
      ? await entityDescription.textContent()
      : '';
  }

  public async expandEntityDescription(group: Groups, option: string) {
    await this.expandIcon(group, option).click();
  }

  public async selectGroupEntity(entity: string, group: Groups) {
    await this.entityOptionByGroup(group, entity).click();
    await this.waitForState({ state: 'hidden' });
  }

  public async isEntityDescriptionFullWidth(group: Groups, option: string) {
    const groupWidth = await this.group(group).evaluate(
      (descr) => descr.clientWidth,
    );
    const descriptionWidth = await this.entityOptionByGroup(
      group,
      option,
    ).evaluate((descr) => descr.clientWidth);
    return groupWidth - descriptionWidth <= 2;
  }

  public async openEntityDescriptionLink(
    group: Groups,
    option: string,
    linkText: string,
  ) {
    await this.entityOptionDescriptionLink(group, option, linkText).click();
  }

  public async getEntityDescriptionLinkColor(
    group: Groups,
    option: string,
    linkText: string,
  ) {
    return this.entityOptionDescriptionLink(
      group,
      option,
      linkText,
    ).getComputedStyleProperty(Styles.textColor);
  }

  public async getEntitiesIcons() {
    const allIcons: EntityIcon[] = [];
    const entitiesCount = await this.groupEntity.getElementsCount();
    for (let i = 1; i <= entitiesCount; i++) {
      const entity = await this.groupEntity.getNthElement(i);
      const entityName = await entity
        .locator(ModelDialog.groupEntityName)
        .textContent();
      const iconHtml = await this.getElementIconHtml(entity);
      allIcons.push({ entityName: entityName!, icon: iconHtml });
    }
    return allIcons;
  }

  public async closeDialog() {
    await this.closeButton.click();
    await this.waitForState({ state: 'hidden' });
  }
}
