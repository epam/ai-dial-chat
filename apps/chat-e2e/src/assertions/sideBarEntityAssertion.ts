import {
  CheckboxState,
  ElementState,
  EntityType,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { SideBarEntities } from '@/src/ui/webElements/entityTree/sidebar/sideBarEntities';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

export class SideBarEntityAssertion<T extends SideBarEntities> {
  readonly sideBarEntities: T;

  constructor(sideBarEntities: T) {
    this.sideBarEntities = sideBarEntities;
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
    const entityLocator = this.sideBarEntities.getEntityByName(
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
    const entityCheckboxLocator = this.sideBarEntities.getEntityCheckbox(
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
        await this.sideBarEntities.getEntityCheckboxState(
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
    const dotsMenuLocator = this.sideBarEntities.entityDotsMenu(
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
    await this.sideBarEntities.getEntityByName(entity.name).hover();
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
      await this.sideBarEntities.getEntityBackgroundColor(
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
    const checkboxElement = this.sideBarEntities.getEntityCheckboxElement(
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
    const checkboxElement = this.sideBarEntities.getEntityCheckboxElement(
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
    const entityIcon = await this.sideBarEntities.getEntityIcon(
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
    const arrowIcon = this.sideBarEntities.getEntityArrowIcon(
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
    const arrowIconColor = await this.sideBarEntities.getEntityArrowIconColor(
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
    const arrowIconsCount = await this.sideBarEntities
      .getEntityArrowIcon(entity.name, entity.index)
      .count();
    expect
      .soft(arrowIconsCount, ExpectedMessages.entitiesIconsCountIsValid)
      .toBe(expectedCount);
  }
}
