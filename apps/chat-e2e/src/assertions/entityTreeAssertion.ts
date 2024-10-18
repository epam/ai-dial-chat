import { BaseAssertion } from '@/src/assertions/baseAssertion';
import {
  CheckboxState,
  ElementState,
  ExpectedMessages,
  TreeEntity,
} from '@/src/testData';
import { Styles } from '@/src/ui/domData';
import { EntitiesTree } from '@/src/ui/webElements/entityTree';
import { expect } from '@playwright/test';

export class EntityTreeAssertion<T extends EntitiesTree> extends BaseAssertion {
  readonly treeEntities: T;

  constructor(treeEntities: T) {
    super();
    this.treeEntities = treeEntities;
  }

  public async assertEntityState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const entityLocator = this.treeEntities.getEntityByName(
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
    const entityCheckboxLocator = this.treeEntities.getEntityCheckbox(
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
        await this.treeEntities.getEntityCheckboxState(
          entity.name,
          entity.index,
        ),
        message,
      )
      .toBe(expectedState);
  }

  public async assertEntityBackgroundColor(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const entityBackgroundColor =
      await this.treeEntities.getEntityBackgroundColor(
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
    const checkboxElement = this.treeEntities.getEntityCheckboxElement(
      entity.name,
      entity.index,
    );
    const color = await checkboxElement.getComputedStyleProperty(Styles.color);
    expect
      .soft(color[0], ExpectedMessages.iconColorIsValid)
      .toBe(expectedColor);
  }

  public async assertEntityCheckboxBorderColors(
    entity: TreeEntity,
    expectedColor: string,
  ) {
    const checkboxElement = this.treeEntities.getEntityCheckboxElement(
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

  public async assertTreeEntityIcon(entity: TreeEntity, expectedIcon: string) {
    const entityIcon = this.treeEntities.getEntityIcon(
      entity.name,
      entity.index,
    );
    await this.assertEntityIcon(entityIcon, expectedIcon);
  }

  public async assertEntityArrowIconState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    const arrowIcon = this.treeEntities.getEntityArrowIcon(
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
    const arrowIconColor = await this.treeEntities.getEntityArrowIconColor(
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
    const arrowIconsCount = await this.treeEntities
      .getEntityArrowIcon(entity.name, entity.index)
      .count();
    expect
      .soft(arrowIconsCount, ExpectedMessages.entitiesIconsCountIsValid)
      .toBe(expectedCount);
  }
}
