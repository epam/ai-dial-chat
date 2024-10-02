import {
  CheckboxState,
  ElementState,
  EntityType,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { SideBarEntitiesTree } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntitiesTree';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

export class SideBarEntityAssertion<T extends SideBarEntitiesTree> {
  readonly sideBarEntitiesTree: T;

  constructor(sideBarEntities: T) {
    this.sideBarEntitiesTree = sideBarEntities;
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

  public async assertEntityState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const entityLocator = this.sideBarEntitiesTree.getEntityByName(
      entity.name,
      entity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(entityLocator, ExpectedMessages.entityIsVisible)
          .toBeVisible()
      : await expect
          .soft(entityLocator, ExpectedMessages.entityIsNotVisible)
          .toBeHidden();
  }

  public async assertEntityCheckbox(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const entityCheckboxLocator = this.sideBarEntitiesTree.getEntityCheckbox(
      entity.name,
      entity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(entityCheckboxLocator, ExpectedMessages.entityIsChecked)
          .toBeVisible()
      : await expect
          .soft(entityCheckboxLocator, ExpectedMessages.entityIsNotChecked)
          .toBeHidden();
  }

  public async assertEntityCheckboxState(
    entity: TreeEntity,
    expectedState: CheckboxState,
  ) {
    const message =
      expectedState === CheckboxState.checked
        ? ExpectedMessages.entityIsChecked
        : ExpectedMessages.entityIsNotChecked;
    expect
      .soft(
        await this.sideBarEntitiesTree.getEntityCheckboxState(
          entity.name,
          entity.index,
        ),
        message,
      )
      .toBe(expectedState);
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
  public async assertEntityBackgroundColor(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const entityBackgroundColor =
      await this.sideBarEntitiesTree.getEntityBackgroundColor(
        entity.name,
        entity.index,
      );
    expect
      .soft(
        entityBackgroundColor,
        ExpectedMessages.entityBackgroundColorIsValid,
      )
      .toBe(expectedColor);
  }

  public async assertEntityCheckboxColor(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const checkboxElement = this.sideBarEntitiesTree.getEntityCheckboxElement(
      entity.name,
      entity.index,
    );
    const color = await checkboxElement.getComputedStyleProperty('color');
    expect
      .soft(color[0], ExpectedMessages.iconColorIsValid)
      .toBe(expectedColor);
  }

  public async assertEntityCheckboxBorderColors(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const checkboxElement = this.sideBarEntitiesTree.getEntityCheckboxElement(
      entity.name,
      entity.index,
    );
    const borderColors = await checkboxElement.getAllBorderColors();

    Object.values(borderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.borderColorsAreValid)
          .toBe(expectedColor);
      });
    });
  }

  public async assertEntityIcon(entity: TreeEntity, expectedIcon: string) {
    const entityIcon = await this.sideBarEntitiesTree.getEntityIcon(
      entity.name,
      entity.index,
    );
    expect
      .soft(entityIcon, ExpectedMessages.entityIconIsValid)
      .toBe(expectedIcon);
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
