import {
  CheckboxState,
  ElementState,
  ExpectedMessages,
  Sorting,
} from '@/src/testData';
import { EntityType, TreeEntity } from '@/src/testData/types';
import { Attributes } from '@/src/ui/domData';
import { Folders } from '@/src/ui/webElements/entityTree';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { expect } from '@playwright/test';

export class FolderAssertion<T extends Folders> {
  readonly folder: T;

  constructor(folder: T) {
    this.folder = folder;
  }

  public async assertFolderState(
    folder: TreeEntity,
    expectedState: ElementState,
  ) {
    const folderLocator = this.folder.getFolderByName(
      folder.name,
      folder.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(folderLocator, ExpectedMessages.folderIsVisible)
          .toBeVisible()
      : await expect
          .soft(folderLocator, ExpectedMessages.folderIsNotVisible)
          .toBeHidden();
  }

  public async assertFolderCheckbox(
    folder: TreeEntity,
    expectedState: ElementState,
  ) {
    const folderCheckboxLocator = this.folder.getFolderCheckbox(
      folder.name,
      folder.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(folderCheckboxLocator, ExpectedMessages.folderIsChecked)
          .toBeVisible()
      : await expect
          .soft(folderCheckboxLocator, ExpectedMessages.folderIsNotChecked)
          .toBeHidden();
  }

  public async assertFolderCheckboxState(
    folder: TreeEntity,
    expectedState: CheckboxState,
  ) {
    const message =
      expectedState === CheckboxState.checked
        ? ExpectedMessages.folderIsChecked
        : expectedState === CheckboxState.partiallyChecked
          ? ExpectedMessages.folderContentIsPartiallyChecked
          : ExpectedMessages.folderIsNotChecked;
    expect
      .soft(
        await this.folder.getFolderCheckboxState(folder.name, folder.index),
        message,
      )
      .toBe(expectedState);
  }

  public async assertFolderAndCheckboxHasSelectedColors(
    folder: TreeEntity,
    theme: string,
    entityType: EntityType,
  ) {
    const { checkboxColor, backgroundColor } =
      ThemesUtil.getEntityCheckboxAndBackgroundColor(theme, entityType);
    await this.assertFolderCheckboxBorderColors(folder, checkboxColor);
    await this.assertFolderBackgroundColor(folder, backgroundColor);
    await this.assertFolderCheckboxColor(folder, checkboxColor);
  }

  public async assertFolderEntityAndCheckboxHasSelectedColors(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    theme: string,
    entityType: EntityType,
  ) {
    const { checkboxColor, backgroundColor } =
      ThemesUtil.getEntityCheckboxAndBackgroundColor(theme, entityType);
    await this.assertFolderEntityCheckboxColor(
      folder,
      folderEntity,
      checkboxColor,
    );
    await this.assertFolderEntityCheckboxBorderColors(
      folder,
      folderEntity,
      checkboxColor,
    );
    await this.assertFolderEntityBackgroundColor(
      folder,
      folderEntity,
      backgroundColor,
    );
  }

  public async assertFolderCheckboxColor(
    folder: TreeEntity,
    expectedCheckboxColor: string,
  ) {
    const folderCheckboxColor = await this.folder.getFolderCheckboxColor(
      folder.name,
      folder.index,
    );
    expect
      .soft(folderCheckboxColor[0], ExpectedMessages.iconColorIsValid)
      .toBe(expectedCheckboxColor);
  }

  public async assertFolderCheckboxBorderColors(
    folder: TreeEntity,
    expectedCheckboxBorderColor: string,
  ) {
    const folderCheckboxBorderColors =
      await this.folder.getFolderCheckboxBorderColors(
        folder.name,
        folder.index,
      );
    Object.values(folderCheckboxBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.borderColorsAreValid)
          .toBe(expectedCheckboxBorderColor);
      });
    });
  }

  public async assertFolderBackgroundColor(
    folder: TreeEntity,
    expectedColor: string,
  ) {
    const folderBackgroundColor = await this.folder.getFolderBackgroundColor(
      folder.name,
      folder.index,
    );
    expect
      .soft(
        folderBackgroundColor[0],
        ExpectedMessages.folderBackgroundColorIsValid,
      )
      .toBe(expectedColor);
  }

  public async assertFolderDotsMenuState(
    folder: TreeEntity,
    expectedState: ElementState,
  ) {
    const dotsMenu = this.folder.folderDotsMenu(folder.name, folder.index);
    expectedState === 'visible'
      ? await expect
          .soft(dotsMenu, ExpectedMessages.dotsMenuIsVisible)
          .toBeVisible()
      : await expect
          .soft(dotsMenu, ExpectedMessages.dotsMenuIsHidden)
          .toBeHidden();
  }

  public async hoverAndAssertFolderDotsMenuState(
    entity: TreeEntity,
    expectedState: ElementState,
  ) {
    await this.folder.getFolderByName(entity.name).hover();
    await this.assertFolderDotsMenuState(
      {
        name: entity.name,
      },
      expectedState,
    );
  }

  public async assertFolderEntityDotsMenuState(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedState: ElementState,
  ) {
    const dotsMenu = this.folder.folderEntityDotsMenu(
      folder.name,
      folderEntity.name,
    );
    expectedState === 'visible'
      ? await expect
          .soft(dotsMenu, ExpectedMessages.dotsMenuIsVisible)
          .toBeVisible()
      : await expect
          .soft(dotsMenu, ExpectedMessages.dotsMenuIsHidden)
          .toBeHidden();
  }

  public async hoverAndAssertFolderEntityDotsMenuState(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedState: ElementState,
  ) {
    const folderEntityLocator = this.folder.getFolderEntity(
      folder.name,
      folderEntity.name,
      folder.index,
      folderEntity.index,
    );
    await folderEntityLocator.hover();
    await this.assertFolderEntityDotsMenuState(
      folder,
      folderEntity,
      expectedState,
    );
  }

  public async assertFolderEntityState(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedState: ElementState,
  ) {
    const folderEntityLocator = this.folder.getFolderEntity(
      folder.name,
      folderEntity.name,
      folder.index,
      folderEntity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(folderEntityLocator, ExpectedMessages.folderEntityIsVisible)
          .toBeVisible()
      : await expect
          .soft(folderEntityLocator, ExpectedMessages.folderEntityIsNotVisible)
          .toBeHidden();
  }

  public async assertFolderEntityCheckbox(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedState: ElementState,
  ) {
    const folderEntityCheckboxLocator = this.folder.getFolderEntityCheckbox(
      folder.name,
      folderEntity.name,
    );
    expectedState === 'visible'
      ? await expect
          .soft(folderEntityCheckboxLocator, ExpectedMessages.entityIsChecked)
          .toBeVisible()
      : await expect
          .soft(
            folderEntityCheckboxLocator,
            ExpectedMessages.entityIsNotChecked,
          )
          .toBeHidden();
  }

  public async assertFolderEntityCheckboxState(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedState: CheckboxState,
  ) {
    const message =
      expectedState === CheckboxState.checked
        ? ExpectedMessages.entityIsChecked
        : ExpectedMessages.entityIsNotChecked;
    expect
      .soft(
        await this.folder.getFolderEntityCheckboxState(
          folder.name,
          folderEntity.name,
          folder.index,
          folderEntity.index,
        ),
        message,
      )
      .toBe(expectedState);
  }

  public async assertFolderEntityCheckboxColor(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedColor: string,
  ) {
    const folderEntityCheckboxColor =
      await this.folder.getFolderEntityCheckboxColor(
        folder.name,
        folderEntity.name,
      );
    expect
      .soft(folderEntityCheckboxColor[0], ExpectedMessages.iconColorIsValid)
      .toBe(expectedColor);
  }

  public async assertFolderEntityCheckboxBorderColors(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedColor: string,
  ) {
    const folderEntityCheckboxBorderColors =
      await this.folder.getFolderEntityCheckboxBorderColors(
        folder.name,
        folderEntity.name,
      );
    Object.values(folderEntityCheckboxBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.borderColorsAreValid)
          .toBe(expectedColor);
      });
    });
  }

  public async assertFolderEntityBackgroundColor(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedColor: string,
  ) {
    const folderEntityBackgroundColor =
      await this.folder.getFolderEntityBackgroundColor(
        folder.name,
        folderEntity.name,
      );
    expect
      .soft(
        folderEntityBackgroundColor[0],
        ExpectedMessages.folderEntityBackgroundColorIsValid,
      )
      .toBe(expectedColor);
  }

  public async assertFolderEditInputState(expectedState: ElementState) {
    const editInputLocator = this.folder
      .getEditFolderInput()
      .getElementLocator();
    expectedState === 'visible'
      ? await expect
          .soft(editInputLocator, ExpectedMessages.folderEditModeIsActive)
          .toBeVisible()
      : await expect
          .soft(editInputLocator, ExpectedMessages.folderEditModeIsClosed)
          .toBeHidden();
  }

  public async assertFolderEditInputValue(expectedValue: string) {
    const inputValue = await this.folder
      .getEditFolderInput()
      .getEditInputValue();
    expect
      .soft(inputValue, ExpectedMessages.charactersAreNotDisplayed)
      .toBe(expectedValue);
  }

  public async assertRootFolderState(
    folder: TreeEntity,
    expectedState: ElementState,
  ) {
    const folderLocator = this.folder.getRootFolderByName(
      folder.name,
      folder.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(folderLocator, ExpectedMessages.folderIsVisible)
          .toBeVisible()
      : await expect
          .soft(folderLocator, ExpectedMessages.folderIsNotVisible)
          .toBeHidden();
  }

  public async assertFolderArrowIconState(
    folder: TreeEntity,
    expectedState: ElementState,
  ) {
    const arrowIcon = this.folder.getFolderArrowIcon(folder.name, folder.index);
    expectedState === 'visible'
      ? await expect
          .soft(arrowIcon, ExpectedMessages.sharedEntityIconIsVisible)
          .toBeVisible()
      : await expect
          .soft(arrowIcon, ExpectedMessages.sharedEntityIconIsNotVisible)
          .toBeHidden();
  }

  public async assertSharedFolderArrowIconColor(
    folder: TreeEntity,
    expectedColor: string,
  ) {
    const arrowIconColor = await this.folder.getFolderArrowIconColor(
      folder.name,
      folder.index,
    );
    expect
      .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
      .toBe(expectedColor);
  }

  public async assertFolderEntityArrowIconState(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    expectedState: ElementState,
  ) {
    const entityArrowIcon = this.folder.getFolderEntityArrowIcon(
      folder.name,
      folderEntity.name,
      folder.index,
      folderEntity.index,
    );
    expectedState === 'visible'
      ? await expect
          .soft(entityArrowIcon, ExpectedMessages.sharedEntityIconIsVisible)
          .toBeVisible()
      : await expect
          .soft(entityArrowIcon, ExpectedMessages.sharedEntityIconIsNotVisible)
          .toBeHidden();
  }

  public async assertFoldersCount(expectedCount: number) {
    const actualFoldersCount = await this.folder.getFoldersCount();
    expect
      .soft(actualFoldersCount, ExpectedMessages.foldersCountIsValid)
      .toBe(expectedCount);
  }

  public async assertFoldersSorting(sorting: Sorting) {
    const allFolderNames = await this.folder.getFolderNames();
    const sortedNames = allFolderNames.slice().sort((a, b) => {
      const nameA = a.toLowerCase();
      const nameB = b.toLowerCase();
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    });
    const expectedOrder =
      sorting === 'asc' ? sortedNames : sortedNames.reverse();
    expect
      .soft(allFolderNames, ExpectedMessages.elementsOrderIsCorrect)
      .toEqual(expectedOrder);
  }

  public async assertFolderSelectedState(
    folder: TreeEntity,
    isSelected: boolean,
  ) {
    await expect
      .soft(
        this.folder.getFolderByName(folder.name, folder.index),
        ExpectedMessages.folderIsHighlighted,
      )
      .toHaveAttribute(Attributes.ariaSelected, String(isSelected));
  }

  public async assertSearchResult(searchFolderPath: string) {
    const searchFolderHierarchyArray = searchFolderPath.split('/');
    const foundFolders = await this.folder.getFolderNames();
    let index = 0;
    const isHierarchyIncludedIntoResults = foundFolders.every(
      (item) => (index = searchFolderHierarchyArray.indexOf(item, index) + 1),
    );
    expect
      .soft(
        isHierarchyIncludedIntoResults,
        ExpectedMessages.searchResultsAreCorrect,
      )
      .toBeTruthy();
  }
}
