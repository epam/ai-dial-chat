import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  FilterMenuOptions,
  FolderPrompt,
  MenuOptions,
  Theme,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';

const fourNestedLevels = 4;
const threeNestedLevels = 3;
const twoNestedLevels = 2;

dialTest(
  `Clicking the 'Select all' button selects all folders and prompts.\n` +
    `Clicking the 'Unselect all' button unselects all folders and prompts.\n` +
    `Select all', 'Unselect all', 'Delete selected prompts' tooltips, icons, highlight`,
  async ({
    dialHomePage,
    prompts,
    promptData,
    folderPrompts,
    promptBar,
    localStorageManager,
    dataInjector,
    promptBarFolderAssertion,
    promptAssertion,
    tooltipAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3667', 'EPMRTC-3669', 'EPMRTC-3666');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let rootFolder: FolderPrompt;
    let singlePrompt: Prompt;
    let theme: string;
    let expectedCheckboxColor: string;
    let expectedEntityBackgroundColor: string;

    await dialTest.step(
      'Prepare nested folders with prompts inside each one, one more root folder with 2 prompts inside and one single prompt',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(fourNestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        rootFolder = promptData.preparePromptsInFolder(2);
        promptData.resetData();

        singlePrompt = promptData.prepareDefaultPrompt();
        promptData.resetData();

        await dataInjector.createPrompts(
          [...nestedPrompts, ...rootFolder.prompts, singlePrompt],
          ...nestedFolders,
          rootFolder.folders,
        );

        theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
        if (theme === Theme.dark) {
          expectedCheckboxColor = Colors.textSecondary;
          expectedEntityBackgroundColor =
            Colors.backgroundAccentTertiaryAlphaDark;
        } else {
          expectedCheckboxColor = Colors.textAccentTertiaryLight;
          expectedEntityBackgroundColor =
            Colors.backgroundAccentTertiaryAlphaLight;
        }

        await localStorageManager.setSettings(theme);
      },
    );

    await dialTest.step(
      'Open app, click on "Select all" button on bottom side panel and verify all folders and prompts are checked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.expandFolder(rootFolder.folders.name);
        await promptBar.selectAllButton.click();

        for (let i = 0; i < nestedFolders.length; i++) {
          await folderPrompts.expandFolder(nestedFolders[i].name);
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            CheckboxState.checked,
          );
        }

        await promptBarFolderAssertion.assertFolderCheckboxState(
          { name: rootFolder.folders.name },
          CheckboxState.checked,
        );

        for (const rootFolderPrompt of rootFolder.prompts) {
          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: rootFolder.folders.name },
            { name: rootFolderPrompt.name },
            CheckboxState.checked,
          );
        }

        await promptAssertion.assertEntityCheckboxState(
          { name: singlePrompt.name },
          CheckboxState.checked,
        );
      },
    );

    await dialTest.step(
      'Verify checkboxes borders and color are valid, entities are highlighted',
      async () => {
        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxColor(
            { name: nestedFolders[i].name },
            expectedCheckboxColor,
          );
          await promptBarFolderAssertion.assertFolderCheckboxBorderColors(
            { name: nestedFolders[i].name },
            expectedCheckboxColor,
          );
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            expectedEntityBackgroundColor,
          );
          await promptBarFolderAssertion.assertFolderEntityCheckboxColor(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            expectedCheckboxColor,
          );
          await promptBarFolderAssertion.assertFolderEntityCheckboxBorderColors(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            expectedCheckboxColor,
          );
          await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            expectedEntityBackgroundColor,
          );
        }
      },
    );

    await dialTest.step(
      'Verify neither folders nor prompts have context menu',
      async () => {
        await folderPrompts.getFolderByName(rootFolder.folders.name).hover();
        await promptBarFolderAssertion.assertFolderDotsMenuState(
          {
            name: rootFolder.folders.name,
          },
          'hidden',
        );
      },
    );

    await dialTest.step('Verify bottom buttons tooltips', async () => {
      await promptBar.selectAllButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.selectAllTooltip,
      );

      await promptBar.unselectAllButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.unselectAllTooltip,
      );

      await promptBar.deleteEntitiesButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.deleteSelectedPromptsTooltip,
      );
    });

    await dialTest.step(
      'Click on "Unselect all" button on bottom side panel and verify all folders and prompts are not checked',
      async () => {
        await promptBar.unselectAllButton.click();
        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderCheckbox(
            {
              name: nestedFolders[i].name,
            },
            'hidden',
          );
          await promptBarFolderAssertion.assertFolderEntityCheckbox(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            'hidden',
          );
        }

        await promptBarFolderAssertion.assertFolderCheckbox(
          {
            name: rootFolder.folders.name,
          },
          'hidden',
        );

        for (const rootFolderPrompt of rootFolder.prompts) {
          await promptBarFolderAssertion.assertFolderEntityCheckbox(
            { name: rootFolder.folders.name },
            { name: rootFolderPrompt.name },
            'hidden',
          );
        }

        await promptAssertion.assertEntityCheckbox(
          {
            name: singlePrompt.name,
          },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify neither folders not prompts are highlighted',
      async () => {
        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );
          await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            Colors.defaultBackground,
          );
        }

        await promptAssertion.assertEntityBackgroundColor(
          { name: singlePrompt.name },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Verify folders and prompts have context menu',
      async () => {
        await folderPrompts.getFolderByName(rootFolder.folders.name).hover();
        await promptBarFolderAssertion.assertFolderDotsMenuState(
          {
            name: rootFolder.folders.name,
          },
          'visible',
        );

        await prompts.getEntityByName(singlePrompt.name).hover();
        await promptAssertion.assertEntityDotsMenuState(
          {
            name: singlePrompt.name,
          },
          'visible',
        );
      },
    );
  },
);

dialTest(
  `Cancel deleting all prompts using the 'Select all' and 'Delete selected prompts' buttons.\n` +
    `Delete all prompts using the 'Select all' and 'Delete selected prompts' buttons`,
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    promptBar,
    confirmationDialog,
    dataInjector,
    confirmationDialogAssertion,
    promptBarFolderAssertion,
    promptAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3670', 'EPMRTC-3671');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let rootFolder: FolderPrompt;
    let singlePrompt: Prompt;

    await dialTest.step(
      'Prepare nested folders with prompts inside each one, one more root folder with 2 prompts inside and one single prompts',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(fourNestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        rootFolder = promptData.preparePromptsInFolder(2);
        promptData.resetData();

        singlePrompt = promptData.prepareDefaultPrompt();

        await dataInjector.createPrompts(
          [...nestedPrompts, ...rootFolder.prompts, singlePrompt],
          ...nestedFolders,
          rootFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Select all entities, click on "Delete selected prompts" and verify modal with confirmation is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.expandFolder(rootFolder.folders.name);
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await promptBar.selectAllButton.click();
        await promptBar.deleteAllEntities();
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.deleteSelectedPromptsMessage,
        );
      },
    );

    await dialTest.step(
      'Cancel delete and verify all entities remain checked',
      async () => {
        await confirmationDialog.cancelDialog();
        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            CheckboxState.checked,
          );
        }

        await promptBarFolderAssertion.assertFolderCheckboxState(
          { name: rootFolder.folders.name },
          CheckboxState.checked,
        );

        for (const rootFolderPrompts of rootFolder.prompts) {
          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: rootFolder.folders.name },
            { name: rootFolderPrompts.name },
            CheckboxState.checked,
          );
        }

        await promptAssertion.assertEntityCheckboxState(
          { name: singlePrompt.name },
          CheckboxState.checked,
        );
      },
    );

    await dialTest.step(
      'Click on "Delete selected prompts", confirmation and verify all entities are removed',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderState(
            {
              name: nestedFolders[i].name,
            },
            'hidden',
          );
          await promptBarFolderAssertion.assertFolderEntityState(
            {
              name: nestedFolders[i].name,
            },
            { name: nestedPrompts[i].name },
            'hidden',
          );
        }

        await promptBarFolderAssertion.assertFolderState(
          {
            name: rootFolder.folders.name,
          },
          'hidden',
        );

        for (const rootFolderPrompt of rootFolder.prompts) {
          await promptBarFolderAssertion.assertFolderEntityState(
            {
              name: rootFolder.folders.name,
            },
            { name: rootFolderPrompt.name },
            'hidden',
          );
        }

        await promptAssertion.assertEntityState(
          {
            name: singlePrompt.name,
          },
          'hidden',
        );
      },
    );
  },
);

dialTest(
  `Clicking the 'Select' option in the root folder's context menu selects the folder with nested objects.\n` +
    `Clicking the 'Select' option in the child folder's context menu selects its nested objects and changes icon near parent.\n` +
    `Delete selected prompts using the 'Select' item in context menu and 'Delete selected prompts' button`,
  async ({
    dialHomePage,
    folderDropdownMenu,
    prompts,
    promptData,
    folderPrompts,
    promptBar,
    confirmationDialog,
    dataInjector,
    promptBarFolderAssertion,
    promptAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3675', 'EPMRTC-3676', 'EPMRTC-3672');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let rootFolder: FolderPrompt;
    let singlePrompt: Prompt;

    await dialTest.step(
      'Prepare nested folders with prompts inside each one, one more root folder with prompt inside and one single prompt',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(fourNestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        rootFolder = promptData.preparePromptInFolder(
          GeneratorUtil.randomString(5),
        );
        promptData.resetData();

        singlePrompt = promptData.prepareDefaultPrompt();

        await dataInjector.createPrompts(
          [...nestedPrompts, ...rootFolder.prompts, singlePrompt],
          ...nestedFolders,
          rootFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Open 2nd level nested hierarchy folder context menu, choose "Select" option and verify all nested elements are checked, root folder is partially checked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.expandFolder(rootFolder.folders.name);
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await folderPrompts.openFolderDropdownMenu(nestedFolders[1].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.select);
        for (let i = 1; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            CheckboxState.checked,
          );
        }

        await promptBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[0].name },
          CheckboxState.partiallyChecked,
        );
      },
    );

    await dialTest.step('Verify other entities stay not checked', async () => {
      await promptBarFolderAssertion.assertFolderEntityCheckbox(
        { name: nestedFolders[0].name },
        { name: nestedPrompts[0].name },
        'hidden',
      );
      await promptBarFolderAssertion.assertFolderCheckbox(
        {
          name: rootFolder.folders.name,
        },
        'hidden',
      );

      await promptBarFolderAssertion.assertFolderEntityCheckbox(
        { name: rootFolder.folders.name },
        { name: rootFolder.prompts[0].name },
        'hidden',
      );

      await promptAssertion.assertEntityCheckbox(
        {
          name: singlePrompt.name,
        },
        'hidden',
      );
    });

    await dialTest.step(
      'Click on single prompt and verify it becomes checked',
      async () => {
        await prompts.getEntityByName(singlePrompt.name).click();
        await promptAssertion.assertEntityCheckboxState(
          { name: singlePrompt.name },
          CheckboxState.checked,
        );
      },
    );

    await dialTest.step(
      'Click on "Delete selected prompts" button at the bottom panel, confirm delete and verify only selected entities are removed',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (let i = 1; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderState(
            {
              name: nestedFolders[i].name,
            },
            'hidden',
          );
          await promptBarFolderAssertion.assertFolderEntityState(
            {
              name: nestedFolders[i].name,
            },
            { name: nestedPrompts[i].name },
            'hidden',
          );
        }

        await promptAssertion.assertEntityState(
          { name: singlePrompt.name },
          'hidden',
        );

        await promptBarFolderAssertion.assertFolderState(
          {
            name: nestedFolders[0].name,
          },
          'visible',
        );
        await promptBarFolderAssertion.assertFolderEntityState(
          { name: nestedFolders[0].name },
          { name: nestedPrompts[0].name },
          'visible',
        );

        await promptBarFolderAssertion.assertFolderState(
          {
            name: rootFolder.folders.name,
          },
          'visible',
        );

        await promptBarFolderAssertion.assertFolderEntityState(
          { name: rootFolder.folders.name },
          { name: rootFolder.prompts[0].name },
          'visible',
        );
      },
    );
  },
);

dialTest(
  `Clicking the 'Select' option in prompt context menu changes folder's selection`,
  async ({
    dialHomePage,
    promptDropdownMenu,
    promptData,
    folderPrompts,
    dataInjector,
    promptBarFolderAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3677');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let secondLevelFolder: FolderPrompt;

    await dialTest.step(
      'Prepare nested folders with prompts inside each one and one more folder with prompt on the second level',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(fourNestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        secondLevelFolder = promptData.preparePromptInFolder(
          GeneratorUtil.randomString(5),
        );
        secondLevelFolder.folders.folderId = `${nestedFolders[0].folderId}/${secondLevelFolder.folders.name}`;
        secondLevelFolder.prompts[0].folderId =
          secondLevelFolder.folders.folderId;
        secondLevelFolder.prompts[0].id = `${nestedFolders[0].folderId}/${secondLevelFolder.prompts[0].id}`;

        await dataInjector.createPrompts(
          [...nestedPrompts, ...secondLevelFolder.prompts],
          ...nestedFolders,
          secondLevelFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Select 3rd level prompt and verify it is highlighted and checked, parent folders are partially checked, rest entities remain unchecked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.expandFolder(secondLevelFolder.folders.name);
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await folderPrompts.openFolderEntityDropdownMenu(
          nestedFolders[fourNestedLevels - 2].name,
          nestedPrompts[fourNestedLevels - 2].name,
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.select);
        await page.mouse.move(0, 0);

        await promptBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[fourNestedLevels - 2].name },
          { name: nestedPrompts[fourNestedLevels - 2].name },
          CheckboxState.checked,
        );

        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[fourNestedLevels - 2].name },
          { name: nestedPrompts[fourNestedLevels - 2].name },
          Colors.backgroundAccentTertiaryAlphaDark,
        );

        for (let i = 0; i < nestedFolders.length; i++) {
          if (i === fourNestedLevels - 1) {
            await promptBarFolderAssertion.assertFolderCheckbox(
              { name: nestedFolders[i].name },
              'hidden',
            );
          } else {
            await promptBarFolderAssertion.assertFolderCheckboxState(
              { name: nestedFolders[i].name },
              CheckboxState.partiallyChecked,
            );
          }
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );
          if (i !== fourNestedLevels - 2) {
            await promptBarFolderAssertion.assertFolderEntityCheckbox(
              { name: nestedFolders[i].name },
              { name: nestedPrompts[i].name },
              'hidden',
            );
            await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
              { name: nestedFolders[i].name },
              { name: nestedPrompts[i].name },
              Colors.defaultBackground,
            );
          }
        }

        await promptBarFolderAssertion.assertFolderCheckbox(
          {
            name: secondLevelFolder.folders.name,
          },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: secondLevelFolder.folders.name },
          Colors.defaultBackground,
        );

        await promptBarFolderAssertion.assertFolderEntityCheckbox(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.prompts[0].name },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.prompts[0].name },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Select lowest level prompt and verify it is highlighted and checked, direct parent folder is checked and highlighted, other parents are partially checked, rest entities remain unchecked',
      async () => {
        await folderPrompts
          .getFolderEntity(
            nestedFolders[fourNestedLevels - 1].name,
            nestedPrompts[fourNestedLevels - 1].name,
          )
          .click();
        await page.mouse.move(0, 0);

        await promptBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[fourNestedLevels - 1].name },
          { name: nestedPrompts[fourNestedLevels - 1].name },
          CheckboxState.checked,
        );

        await promptBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[fourNestedLevels - 1].name },
          CheckboxState.checked,
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[fourNestedLevels - 1].name },
          Colors.backgroundAccentTertiaryAlphaDark,
        );

        for (let i = 0; i < nestedFolders.length - 2; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.partiallyChecked,
          );
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );

          await promptBarFolderAssertion.assertFolderEntityCheckbox(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            'hidden',
          );
          await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            Colors.defaultBackground,
          );
        }

        await promptBarFolderAssertion.assertFolderCheckbox(
          {
            name: secondLevelFolder.folders.name,
          },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: secondLevelFolder.folders.name },
          Colors.defaultBackground,
        );

        await promptBarFolderAssertion.assertFolderEntityCheckbox(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.prompts[0].name },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.prompts[0].name },
          Colors.defaultBackground,
        );
      },
    );
  },
);

dialTest(
  `Selecting all prompts and unselecting checked items changes folder's selection.\n` +
    `Verify selection of a prompt in 'selection view'`,
  async ({
    dialHomePage,
    promptDropdownMenu,
    promptData,
    folderPrompts,
    page,
    dataInjector,
    promptBarFolderAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3678', 'EPMRTC-3681');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let lowLevelFolderPrompt: Prompt;
    let secondLevelFolder: FolderPrompt;

    await dialTest.step(
      'Prepare nested folders with prompts inside each one, one more folder with prompt on the second level, and one more prompt on the lowest folder level',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(threeNestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        lowLevelFolderPrompt = promptData.prepareDefaultPrompt();
        lowLevelFolderPrompt.folderId = nestedFolders[threeNestedLevels - 1].id;
        lowLevelFolderPrompt.id = `${lowLevelFolderPrompt.folderId}/${lowLevelFolderPrompt.id}`;
        promptData.resetData();

        secondLevelFolder = promptData.prepareDefaultPromptInFolder();
        secondLevelFolder.folders.folderId = `${nestedFolders[1].folderId}/${secondLevelFolder.folders.name}`;
        secondLevelFolder.prompts[0].folderId =
          secondLevelFolder.folders.folderId;
        secondLevelFolder.prompts[0].id = `${nestedFolders[1].folderId}/${secondLevelFolder.prompts[0].id}`;

        await dataInjector.createPrompts(
          [
            ...nestedPrompts,
            lowLevelFolderPrompt,
            ...secondLevelFolder.prompts,
          ],
          ...nestedFolders,
          secondLevelFolder.folders,
        );
      },
    );

    await dialTest.step('Select middle and lowest level prompts', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      for (const nestedFolder of nestedFolders) {
        await folderPrompts.expandFolder(nestedFolder.name);
      }
      await folderPrompts.expandFolder(secondLevelFolder.folders.name);
      await folderPrompts.openFolderEntityDropdownMenu(
        nestedFolders[1].name,
        nestedPrompts[1].name,
      );
      await promptDropdownMenu.selectMenuOption(MenuOptions.select);
      await folderPrompts
        .getFolderEntity(
          nestedFolders[threeNestedLevels - 1].name,
          nestedPrompts[threeNestedLevels - 1].name,
        )
        .click();
    });

    await dialTest.step(
      'Hover over second lowest level prompt and verify not-checked checkbox with highlighted borders is displayed',
      async () => {
        await folderPrompts
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderPrompt.name,
          )
          .hover();
        await promptBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderPrompt.name },
          CheckboxState.unchecked,
        );

        await folderPrompts
          .getFolderEntityCheckbox(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderPrompt.name,
          )
          .hover();
        await promptBarFolderAssertion.assertFolderEntityCheckboxBorderColors(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderPrompt.name },
          Colors.textSecondary,
        );
      },
    );

    await dialTest.step(
      'Select second lowest level prompt and verify they are highlighted and checked, direct parent folders are checked and highlighted, rest parent folders are partially checked, rest entities remain unchecked',
      async () => {
        await folderPrompts
          .getFolderEntityCheckbox(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderPrompt.name,
          )
          .click();
        await promptBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[0].name },
          CheckboxState.partiallyChecked,
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[0].name },
          Colors.defaultBackground,
        );

        await promptBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[0].name },
          { name: nestedPrompts[0].name },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[0].name },
          { name: nestedPrompts[0].name },
          Colors.defaultBackground,
        );

        for (let i = 1; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.backgroundAccentTertiaryAlphaDark,
          );

          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            Colors.backgroundAccentTertiaryAlphaDark,
          );
        }

        await promptBarFolderAssertion.assertFolderCheckbox(
          {
            name: secondLevelFolder.folders.name,
          },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: secondLevelFolder.folders.name },
          Colors.defaultBackground,
        );

        await promptBarFolderAssertion.assertFolderEntityCheckbox(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.prompts[0].name },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.prompts[0].name },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Unselect second lowest level prompt and verify only middle level prompt is highlighted and checked, middle level prompt direct parents are partially checked',
      async () => {
        await folderPrompts
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            nestedPrompts[threeNestedLevels - 1].name,
          )
          .click();
        await folderPrompts
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderPrompt.name,
          )
          .click();
        await page.mouse.move(0, 0);

        await promptBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[1].name },
          { name: nestedPrompts[1].name },
          CheckboxState.checked,
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[1].name },
          { name: nestedPrompts[1].name },
          Colors.backgroundAccentTertiaryAlphaDark,
        );

        for (let i = 0; i < 1; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.partiallyChecked,
          );
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );

          if (i !== 1) {
            await promptBarFolderAssertion.assertFolderEntityCheckbox(
              { name: nestedFolders[i].name },
              { name: nestedPrompts[i].name },
              'hidden',
            );
            await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
              { name: nestedFolders[i].name },
              { name: nestedPrompts[i].name },
              Colors.defaultBackground,
            );
          }
        }

        await promptBarFolderAssertion.assertFolderCheckbox(
          {
            name: nestedFolders[threeNestedLevels - 1].name,
          },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          Colors.defaultBackground,
        );

        for (const folderConversation of [
          nestedPrompts[threeNestedLevels - 1].name,
          lowLevelFolderPrompt.name,
        ]) {
          await promptBarFolderAssertion.assertFolderEntityCheckbox(
            { name: nestedFolders[threeNestedLevels - 1].name },
            { name: folderConversation },
            'hidden',
          );
          await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[threeNestedLevels - 1].name },
            { name: folderConversation },
            Colors.defaultBackground,
          );
        }
      },
    );
  },
);

dialTest(
  `Unselecting folder.\n` +
    `Verify selection of a prompt folder in 'selection view'.\n` +
    `Verify deselection of a prompt folder in 'selection view'`,
  async ({
    dialHomePage,
    promptDropdownMenu,
    promptData,
    folderPrompts,
    dataInjector,
    promptBarFolderAssertion,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3679', 'EPMRTC-3680', 'EPMRTC-3682');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let lowLevelFolderPrompt: Prompt;

    await dialTest.step(
      'Prepare nested folders with prompts inside each one and one more prompt on the lowest folder level',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(threeNestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        lowLevelFolderPrompt = promptData.prepareDefaultPrompt();
        lowLevelFolderPrompt.folderId = nestedFolders[threeNestedLevels - 1].id;
        lowLevelFolderPrompt.id = `${lowLevelFolderPrompt.folderId}/${lowLevelFolderPrompt.id}`;

        await dataInjector.createPrompts(
          [...nestedPrompts, lowLevelFolderPrompt],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Select middle level prompt via context menu, hover over lowest level folder and verify not-checked checkbox with borders is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }

        await folderPrompts.openFolderEntityDropdownMenu(
          nestedFolders[1].name,
          nestedPrompts[1].name,
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.select);

        await folderPrompts
          .getFolderByName(nestedFolders[threeNestedLevels - 1].name)
          .hover();

        await promptBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          CheckboxState.unchecked,
        );
        await folderPrompts
          .getFolderCheckbox(nestedFolders[threeNestedLevels - 1].name)
          .hover();
        await promptBarFolderAssertion.assertFolderCheckboxBorderColors(
          { name: nestedFolders[threeNestedLevels - 1].name },
          Colors.textSecondary,
        );
      },
    );

    await dialTest.step(
      'Select middle level folder and verify its inner content is highlighted and checked, root folder is partially checked',
      async () => {
        await folderPrompts.getFolderCheckbox(nestedFolders[1].name).click();

        for (let i = 1; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.backgroundAccentTertiaryAlphaDark,
          );

          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            Colors.backgroundAccentTertiaryAlphaDark,
          );
        }

        await promptBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderPrompt.name },
          CheckboxState.checked,
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderPrompt.name },
          Colors.backgroundAccentTertiaryAlphaDark,
        );

        await promptBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[0].name },
          CheckboxState.partiallyChecked,
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[0].name },
          Colors.defaultBackground,
        );

        await promptBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[0].name },
          { name: nestedPrompts[0].name },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[0].name },
          { name: nestedPrompts[0].name },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Unselect lowest level folder and verify this folder with inner content are not highlighted and checked, parent folders are partially checked',
      async () => {
        await folderPrompts
          .getFolderCheckbox(nestedFolders[threeNestedLevels - 1].name)
          .click();
        await page.mouse.move(0, 0);

        await promptBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[1].name },
          { name: nestedPrompts[1].name },
          CheckboxState.checked,
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[1].name },
          { name: nestedPrompts[1].name },
          Colors.backgroundAccentTertiaryAlphaDark,
        );

        for (let i = 0; i < nestedFolders.length - 1; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.partiallyChecked,
          );
          await promptBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );
        }

        await promptBarFolderAssertion.assertFolderCheckbox(
          {
            name: nestedFolders[threeNestedLevels - 1].name,
          },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          Colors.defaultBackground,
        );

        await promptBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: nestedPrompts[threeNestedLevels - 1].name },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: nestedPrompts[threeNestedLevels - 1].name },
          Colors.defaultBackground,
        );

        await promptBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderPrompt.name },
          'hidden',
        );
        await promptBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderPrompt.name },
          Colors.defaultBackground,
        );
      },
    );
  },
);

dialTest(
  `Verify exiting 'selection view'`,
  async ({
    dialHomePage,
    promptDropdownMenu,
    folderDropdownMenu,
    promptData,
    prompts,
    folderPrompts,
    promptBarAssertion,
    promptBar,
    promptFilter,
    promptFilterDropdownMenu,
    dataInjector,
    promptModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3684');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let singlePrompt: Prompt;

    await dialTest.step(
      'Prepare nested folders with prompts inside each one and one more single prompt',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(twoNestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        singlePrompt = promptData.prepareDefaultPrompt();

        await dataInjector.createPrompts(
          [...nestedPrompts, singlePrompt],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Select single prompt, unselect it and verify bottom panel does not include "select" buttons',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await prompts.openEntityDropdownMenu(singlePrompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.select);
        await promptBarAssertion.assertUnselectAllButtonState('visible');

        await prompts.getEntityCheckbox(singlePrompt.name).click();
        await promptBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );

    await dialTest.step(
      'Select prompt in folder, unselect it and verify bottom panel does not include "select" buttons',
      async () => {
        await folderPrompts.openFolderEntityDropdownMenu(
          nestedFolders[twoNestedLevels - 1].name,
          nestedPrompts[twoNestedLevels - 1].name,
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.select);
        await folderPrompts
          .getFolderEntityCheckbox(
            nestedFolders[twoNestedLevels - 1].name,
            nestedPrompts[twoNestedLevels - 1].name,
          )
          .click();
        await promptBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );

    await dialTest.step(
      'Select folder, unselect it and verify bottom panel does not include "select" buttons',
      async () => {
        await folderPrompts.openFolderDropdownMenu(nestedFolders[0].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.select);
        await folderPrompts.getFolderCheckbox(nestedFolders[0].name).click();
        await promptBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );

    await dialTest.step(
      'Select single conversation, press "Create New Conversation" button and verify bottom panel does not include "select" buttons',
      async () => {
        await prompts.openEntityDropdownMenu(singlePrompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.select);
        await promptBar.createNewPrompt();
        await promptBarAssertion.assertUnselectAllButtonState('hidden');
        await promptModalDialog.closeButton.click();
      },
    );

    await dialTest.step(
      'Select single conversation, set some search term and verify bottom panel does not include "select" buttons',
      async () => {
        await prompts.openEntityDropdownMenu(singlePrompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.select);
        await promptBar.getSearch().setSearchValue('test');
        await promptBarAssertion.assertUnselectAllButtonState('hidden');
        await promptBar.getSearch().setSearchValue('');
      },
    );

    await dialTest.step(
      'Select single conversation, set Share filter to some value and verify bottom panel does not include "select" buttons',
      async () => {
        await prompts.openEntityDropdownMenu(singlePrompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.select);
        await promptFilter.openFilterDropdownMenu();
        await promptFilterDropdownMenu.selectOption(
          FilterMenuOptions.sharedByMe,
        );
        await promptBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );
  },
);

dialTest(
  'Select folder from search result select only visible prompts',
  async ({
    dialHomePage,
    folderDropdownMenu,
    promptData,
    folderPrompts,
    dataInjector,
    promptBarFolderAssertion,
    promptBarSearch,
    promptBar,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3912');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    let lowLevelFolderPrompt: Prompt;
    const duplicatedPromptName = ExpectedConstants.newPromptTitle(1);

    await dialTest.step(
      'Prepare nested folders with prompts inside each one and one more prompt on the lowest folder level',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(twoNestedLevels);
        nestedPrompts = promptData.preparePromptsForNestedFolders(
          nestedFolders,
          {
            1: duplicatedPromptName,
            2: ExpectedConstants.newPromptTitle(2),
          },
        );
        promptData.resetData();
        lowLevelFolderPrompt =
          promptData.prepareDefaultPrompt(duplicatedPromptName);
        lowLevelFolderPrompt.folderId = nestedFolders[twoNestedLevels - 1].id;
        lowLevelFolderPrompt.id = `${lowLevelFolderPrompt.folderId}/${lowLevelFolderPrompt.id}`;

        await dataInjector.createPrompts(
          [...nestedPrompts, lowLevelFolderPrompt],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Search prompts from nested folders, select root folder and verify hierarchy checked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await promptBarSearch.setSearchValue(duplicatedPromptName);
        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderEntityState(
            { name: nestedFolders[i].name },
            {
              name: duplicatedPromptName,
              index: twoNestedLevels - i,
            },
            'visible',
          );
        }
        await promptBarFolderAssertion.assertFolderEntityState(
          { name: nestedFolders[twoNestedLevels - 1].name },
          { name: ExpectedConstants.newConversationWithIndexTitle(2) },
          'hidden',
        );

        await folderPrompts.openFolderDropdownMenu(nestedFolders[0].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.select);

        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await promptBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            {
              name: duplicatedPromptName,
              index: twoNestedLevels - i,
            },
            CheckboxState.checked,
          );
        }
      },
    );

    await dialTest.step(
      'Click "Delete selected prompts" button, confirm and verify only selected entities are deleted',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await promptBarSearch.setSearchValue('');

        await promptBarFolderAssertion.assertFolderEntityState(
          { name: nestedFolders[twoNestedLevels - 1].name },
          { name: ExpectedConstants.newPromptTitle(2) },
          'visible',
        );

        for (let i = 0; i < nestedFolders.length; i++) {
          await promptBarFolderAssertion.assertFolderState(
            { name: nestedFolders[i].name },
            'visible',
          );
          await promptBarFolderAssertion.assertFolderEntityState(
            { name: nestedFolders[i].name },
            {
              name: duplicatedPromptName,
              index: twoNestedLevels - i,
            },
            'hidden',
          );
        }
      },
    );
  },
);
