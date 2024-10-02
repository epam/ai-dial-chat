import { EntityTreeAssertion } from '@/src/assertions/entityTreeAssertion';
import {
  ElementState,
  EntityType,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntitiesTree';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

export class SideBarEntityAssertion<
  T extends SideBarEntitiesTree,
> extends EntityTreeAssertion<SideBarEntitiesTree> {
  readonly sideBarEntitiesTree: T;

  constructor(sideBarEntitiesTree: T) {
    super(sideBarEntitiesTree);
    this.sideBarEntitiesTree = sideBarEntitiesTree;
  }

  public async assertEntityAndCheckboxHasSelectedColors(
    entity: TreeEntity,
    theme: string,
    entityType: EntityType,
  ) {
    const { checkboxColor, backgroundColor } =
      ThemesUtil.getEntityCheckboxAndBackgroundColor(theme, entityType);
    await this.assertEntityCheckboxColor(entity, checkboxColor);
    await this.assertEntityCheckboxBorderColors(entity, checkboxColor);
    await this.assertEntityBackgroundColor(entity, backgroundColor);
  }

  public async assertEntityDotsMenuState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const dotsMenuLocator = this.sideBarEntitiesTree.entityDotsMenu(
      entity.name,
      entity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(dotsMenuLocator, ExpectedMessages.dotsMenuIsVisible)
          .toBeVisible()
      : await expect
          .soft(dotsMenuLocator, ExpectedMessages.dotsMenuIsHidden)
          .toBeHidden();
  }

  public async hoverAndAssertEntityDotsMenuState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    await this.sideBarEntitiesTree.getEntityByName(entity.name).hover();
    await this.assertEntityDotsMenuState(
      {
        name: entity.name,
      },
      expectedState,
    );
  }

  public async assertEntityArrowIconState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const arrowIcon = this.sideBarEntitiesTree.getEntityArrowIcon(
      entity.name,
      entity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(arrowIcon, ExpectedMessages.sharedEntityIconIsVisible)
          .toBeVisible()
      : await expect
          .soft(arrowIcon, ExpectedMessages.sharedEntityIconIsNotVisible)
          .toBeHidden();
  }

  public async assertEntityArrowIconColor(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const arrowIconColor =
      await this.sideBarEntitiesTree.getEntityArrowIconColor(
        entity.name,
        entity.index,
      );
    expect
      .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
      .toBe(expectedColor);
  }

  public async assertEntityArrowIconsCount(
    entity: TreeEntity,
    expectedCount: number,
  ) {
    const arrowIconsCount = await this.sideBarEntitiesTree
      .getEntityArrowIcon(entity.name, entity.index)
      .count();
    expect
      .soft(arrowIconsCount, ExpectedMessages.entitiesIconsCountIsValid)
      .toBe(expectedCount);
  }

  public async assertEntitiesCount(actualCount: number, expectedCount: number) {
    expect
      .soft(actualCount, ExpectedMessages.entitiesCountIsValid)
      .toBe(expectedCount);
  }
}
