import { Attributes, Styles } from '@/src/ui/domData';
import { EntityTreeSelectors, IconSelectors } from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { Locator, Page } from '@playwright/test';

export class EntitiesTree extends BaseElement {
  protected entitySelector: string;

  constructor(
    page: Page,
    parentLocator: Locator,
    rootSelector: string,
    entitySelector: string,
  ) {
    super(page, rootSelector, parentLocator);
    this.entitySelector = entitySelector;
  }

  getEntityByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      this.entitySelector,
    ).getElementLocatorByText(name, index);
  }

  getEntityName(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getEntityByName(name, index).locator(EntityTreeSelectors.entityName),
    );
  }

  getEntityCheckbox(name: string, index?: number) {
    return this.getEntityByName(name, index).getByRole('checkbox');
  }

  getEntityCheckboxElement(name: string, index?: number) {
    return this.createElementFromLocator(this.getEntityCheckbox(name, index));
  }

  async getEntityCheckboxState(name: string, index?: number) {
    return this.getEntityCheckbox(name, index).getAttribute(Attributes.dataQA);
  }

  async getEntityIcon(name: string, index?: number) {
    const entity = this.getEntityByName(name, index);
    return this.getElementIconHtml(entity);
  }

  public async getEntityBackgroundColor(name: string, index?: number) {
    const backgroundColor = await this.createElementFromLocator(
      this.getEntityByName(name, index),
    ).getComputedStyleProperty(Styles.backgroundColor);
    return backgroundColor[0];
  }

  public async getEntitiesCount() {
    return this.getChildElementBySelector(
      this.entitySelector,
    ).getElementsCount();
  }

  public getEntityPlaybackIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      IconSelectors.playbackIcon,
    );
  }

  public getEntityReplayIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(IconSelectors.replayIcon);
  }
}
