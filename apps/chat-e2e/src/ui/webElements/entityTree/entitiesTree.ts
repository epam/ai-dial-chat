import { Attributes, Styles, Tags } from '@/src/ui/domData';
import {
  EntitySelectors,
  IconSelectors,
  SideBarSelectors,
} from '@/src/ui/selectors';
import { BaseElement } from '@/src/ui/webElements';
import { RegexUtil } from '@/src/utils';
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

  public async getAllTreeEntitiesNames(): Promise<string[]> {
    const entities = await this.getAllTreeEntities();
    const names: string[] = [];

    for (const entity of entities) {
      const nameElement = entity.locator(EntitySelectors.entityName);
      const name = await nameElement.textContent();
      if (name) {
        names.push(name);
      }
    }

    return names;
  }

  public async getAllTreeEntitiesWithIndices(): Promise<
    { name: string; index: number }[]
  > {
    const entities = await this.getAllTreeEntities();
    const namesWithIndices: { name: string; index: number }[] = [];
    const nameOccurrences: Record<string, number> = {};

    for (const entity of entities) {
      const nameElement = entity.locator(EntitySelectors.entityName);
      const name = await nameElement.textContent();
      if (name) {
        nameOccurrences[name] = (nameOccurrences[name] || 0) + 1;
        namesWithIndices.push({
          name,
          index: nameOccurrences[name],
        });
      }
    }

    return namesWithIndices;
  }

  public async getAllTreeEntities(): Promise<Locator[]> {
    const allEntities = this.getChildElementBySelector(this.entitySelector)
      .getElementLocator()
      .all();
    return allEntities;
  }

  getTreeEntity(
    name: string,
    indexOrOptions?: number | { exactMatch: boolean; index?: number },
  ) {
    let index: number | undefined;
    if (typeof indexOrOptions === 'number') {
      // Existing behavior
      index = indexOrOptions;
      return this.getEntityByName(name, index);
    } else if (
      typeof indexOrOptions === 'object' &&
      indexOrOptions.exactMatch
    ) {
      // New exact match behavior
      index = indexOrOptions.index;
      return this.getEntityByExactName(name, index);
    } else {
      // Default behavior (partial match, no index)
      return this.getEntityByName(name);
    }
  }

  getEntityByName(name: string, index?: number) {
    return this.getChildElementBySelector(
      this.entitySelector,
    ).getElementLocatorByText(name, index);
  }

  getEntityByExactName(name: string, index?: number): Locator {
    return this.getChildElementBySelector(this.entitySelector)
      .getElementLocator()
      .filter({ hasText: new RegExp(`^${RegexUtil.escapeRegexChars(name)}$`) })
      .nth(index ? index - 1 : 0);
  }

  getEntityName(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getEntityByName(name, index).locator(EntitySelectors.entityName),
    );
  }

  test() {
    return this.getElementLocator().locator(EntitySelectors.entityName);
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

  getEntityIcon(name: string, index?: number) {
    const entity = this.getEntityByName(name, index);
    return this.getElementIcon(entity);
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

  getEntityArrowIcon(name: string, index?: number) {
    return this.getEntityByName(name, index).locator(
      SideBarSelectors.arrowAdditionalIcon,
    );
  }

  getEntityArrowIconColor(name: string, index?: number) {
    return this.createElementFromLocator(
      this.getEntityArrowIcon(name, index).locator(Tags.svg),
    ).getComputedStyleProperty(Styles.color);
  }
}
