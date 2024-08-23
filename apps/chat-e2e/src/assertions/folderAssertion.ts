import {
  CheckboxState,
  ElementState,
  ExpectedMessages,
  Theme,
} from '@/src/testData';
import { TreeEntity } from '@/src/testData/types';
import { Colors } from '@/src/ui/domData';
import { Folders } from '@/src/ui/webElements';
import { expect } from '@playwright/test';

export class FolderAssertion {
  readonly folder: Folders;

  constructor(folder: Folders) {
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
  ) {
    let expectedCheckboxColor: string;
    let expectedEntityBackgroundColor: string;

    if (theme == Theme.dark) {
      expectedCheckboxColor = Colors.textAccentSecondary;
      expectedEntityBackgroundColor = Colors.backgroundAccentSecondaryAlphaDark;
    } else {
      expectedCheckboxColor = Colors.backgroundAccentSecondaryLight;
      expectedEntityBackgroundColor =
        Colors.backgroundAccentSecondaryAlphaLight;
    }
    await this.assertFolderCheckboxBorderColors(folder, expectedCheckboxColor);
    await this.assertFolderBackgroundColor(
      folder,
      expectedEntityBackgroundColor,
    );
    await this.assertFolderCheckboxColor(folder, expectedCheckboxColor);
  }

  public async assertFolderEntityAndCheckboxHasSelectedColors(
    folder: TreeEntity,
    folderEntity: TreeEntity,
    theme: string,
  ) {
    let expectedCheckboxColor: string;
    let expectedEntityBackgroundColor: string;

    if (theme == Theme.dark) {
      expectedCheckboxColor = Colors.textAccentSecondary;
      expectedEntityBackgroundColor = Colors.backgroundAccentSecondaryAlphaDark;
    } else {
      expectedCheckboxColor = Colors.backgroundAccentSecondaryLight;
      expectedEntityBackgroundColor =
        Colors.backgroundAccentSecondaryAlphaLight;
    }
    await this.assertFolderEntityCheckboxColor(
      folder,
      folderEntity,
      expectedCheckboxColor,
    );
    await this.assertFolderEntityCheckboxBorderColors(
      folder,
      folderEntity,
      expectedCheckboxColor,
    );
    await this.assertFolderEntityBackgroundColor(
      folder,
      folderEntity,
      expectedEntityBackgroundColor,
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
  ){
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
    const dotsMenu = this.folder.folderEntityDotsMenu(folder.name, folderEntity.name);
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
    await this.assertFolderEntityDotsMenuState(folder,folderEntity,expectedState);
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
}
