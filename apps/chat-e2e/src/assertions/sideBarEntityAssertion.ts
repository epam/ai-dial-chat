import { EntityTreeAssertion } from '@/src/assertions/base/entityTreeAssertion';
import { ElementState, ExpectedMessages, TreeEntity } from '@/src/testData';
import { Cursors, ThemeColorAttributes } from '@/src/ui/domData';
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
    expectedColors: { checkboxColor: string; entityBackgroundColor: string },
  ) {
    await this.assertEntityCheckboxColor(entity, expectedColors.checkboxColor);
    await this.assertEntityCheckboxBorderColors(
      entity,
      expectedColors.checkboxColor,
    );
    await this.assertEntityBackgroundColor(
      entity,
      expectedColors.entityBackgroundColor,
    );
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

  public async assertEntitiesCount(
    expectedCount: number,
    actualCount?: number,
  ) {
    if (actualCount === undefined) {
      await this.assertElementsCount(
        this.sideBarEntitiesTree.treeEntityNames,
        expectedCount,
      );
    } else {
      this.assertValue(
        expectedCount,
        actualCount,
        ExpectedMessages.elementsCountIsValid,
      );
    }
  }

  public async assertSelectedEntity(name: string) {
    const selectedEntity = this.sideBarEntitiesTree.selectedEntity(name);

    await this.assertElementState(selectedEntity, 'visible');
    await this.assertEntityBackgroundColor(
      { name: name },
      ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgAccentSecondaryAlpha),
    );
  }

  public async assertEntityCursor(name: string, expectedCursor: Cursors) {
    await this.sideBarEntitiesTree.getEntityByName(name).hover();
    await super.assertElementCursor(
      this.sideBarEntitiesTree.getEntityName(name),
      expectedCursor,
    );
  }

  public async assertNoEntityIsSelected() {
    const selectedEntities =
      await this.sideBarEntitiesTree.getSelectedEntities();
    expect
      .soft(selectedEntities.length, ExpectedMessages.noConversationIsSelected)
      .toBe(0);
  }
}
