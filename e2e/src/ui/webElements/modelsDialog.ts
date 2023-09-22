import { ModelDialog } from '../selectors';
import { BaseElement } from './baseElement';

import { Groups } from '@/e2e/src/testData';
import { Styles, Tags } from '@/e2e/src/ui/domData';
import { Page } from '@playwright/test';

export class ModelsDialog extends BaseElement {
  constructor(page: Page) {
    super(page, ModelDialog.modelDialog);
  }

  public group = (group: Groups) =>
    this.getChildElementBySelector(
      ModelDialog.talkToGroup,
    ).getElementLocatorByText(group);

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
}
