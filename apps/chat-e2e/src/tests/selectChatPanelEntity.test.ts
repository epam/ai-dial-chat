import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  CollapsedSections,
  EntityType,
  ExpectedConstants,
  FilterMenuOptions,
  FolderConversation,
  MenuOptions,
  Theme,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';

const fourNestedLevels = 4;
const threeNestedLevels = 3;
const twoNestedLevels = 2;

dialTest(
  `Clicking the 'Select all' button selects all folders and conversations.\n` +
    `Clicking the 'Unselect all' button unselects all folders and conversations.\n` +
    `'Select all', 'Unselect all', 'Delete selected conversations' tooltips, icons, highlight`,
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    chatBar,
    localStorageManager,
    dataInjector,
    chatBarFolderAssertion,
    conversationAssertion,
    tooltipAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3638', 'EPMRTC-3639', 'EPMRTC-3644');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let folderWithConversations: FolderConversation;
    let emptyConversation: Conversation;
    let historyConversation: Conversation;
    let theme: string;
    let expectedEntityBackgroundColor: string;
    const emptyFolderName = ExpectedConstants.newFolderWithIndexTitle(1);

    await dialTest.step(
      'Prepare nested folders with conversations inside each one, one more root folder with 2 conversations inside, one empty conversation and one conversation with history',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(fourNestedLevels, {
          1: `${ExpectedConstants.newFolderTitle} p1`,
          2: ExpectedConstants.newFolderWithIndexTitle(2),
          3: ExpectedConstants.newFolderWithIndexTitle(3),
          4: ExpectedConstants.newFolderWithIndexTitle(4),
        });
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        // Prepare folder with two conversations
        folderWithConversations =
          conversationData.prepareFolderWithConversations(
            2,
            `${ExpectedConstants.newFolderTitle} p2`,
          );
        conversationData.resetData();

        // Prepare conversations in Today section
        emptyConversation = conversationData.prepareEmptyConversation(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        conversationData.resetData();

        historyConversation = conversationData.prepareDefaultConversation(
          ExpectedConstants.newFolderWithIndexTitle(2),
        );

        await dataInjector.createConversations(
          [
            ...nestedConversations,
            ...folderWithConversations.conversations,
            emptyConversation,
            historyConversation,
          ],
          ...nestedFolders,
          folderWithConversations.folders,
        );

        theme = Theme.dark;
        expectedEntityBackgroundColor =
          Colors.backgroundAccentSecondaryAlphaDark;
        await localStorageManager.setSettings(theme);
        await localStorageManager.setChatCollapsedSection(
          CollapsedSections.Organization,
        );
      },
    );

    await dialTest.step(
      'Open app and prepare the folder and conversation structure',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        // await conversations.openEntityDropdownMenu(ExpectedConstants.newConversationWithIndexTitle(1));
        // await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        // await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.selectFolderEntity(
          nestedFolders[fourNestedLevels - 1].name,
          nestedConversations[fourNestedLevels - 1].name,
        );
        await folderConversations.expandFolder(
          folderWithConversations.folders.name,
        );
        await chatBar.createNewFolder();
      },
    );

    await dialTest.step(
      'Click "Select all" button and verify all folders are checked',
      async () => {
        await chatBar.selectAllButton.click();

        // Nested folders and prompts
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            CheckboxState.checked,
          );
        }

        // Folder with two prompts
        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: folderWithConversations.folders.name },
          CheckboxState.checked,
        );

        // Empty folder
        for (const conversation of folderWithConversations.conversations) {
          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: folderWithConversations.folders.name },
            { name: conversation.name },
            CheckboxState.checked,
          );
        }

        // Single prompt
        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: emptyFolderName },
          CheckboxState.checked,
        );

        for (const conversation of [emptyConversation, historyConversation]) {
          await conversationAssertion.assertEntityCheckboxState(
            { name: conversation.name },
            CheckboxState.checked,
          );
        }
      },
    );

    await dialTest.step(
      'Verify checkboxes borders and color are valid, entities are highlighted',
      async () => {
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderAndCheckboxHasSelectedColors(
            { name: nestedFolders[i].name },
            theme,
            EntityType.Conversation,
          );
          await chatBarFolderAssertion.assertFolderEntityAndCheckboxHasSelectedColors(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            theme,
            EntityType.Conversation,
          );
        }

        await chatBarFolderAssertion.assertFolderAndCheckboxHasSelectedColors(
          { name: folderWithConversations.folders.name },
          theme,
          EntityType.Conversation,
        );
        for (const item of folderWithConversations.conversations) {
          await chatBarFolderAssertion.assertFolderEntityAndCheckboxHasSelectedColors(
            { name: folderWithConversations.folders.name },
            { name: item.name },
            theme,
            EntityType.Conversation,
          );
        }

        await chatBarFolderAssertion.assertFolderAndCheckboxHasSelectedColors(
          { name: emptyFolderName },
          theme,
          EntityType.Conversation,
        );

        for (const conversation of [emptyConversation, historyConversation]) {
          await conversationAssertion.assertEntityAndCheckboxHasSelectedColors(
            { name: conversation.name },
            theme,
            EntityType.Conversation,
          );
        }
      },
    );

    await dialTest.step(
      'Verify neither folders nor conversations have context menu',
      async () => {
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.hoverAndAssertFolderDotsMenuState(
            nestedFolders[i],
            'hidden',
          );
          await chatBarFolderAssertion.hoverAndAssertFolderEntityDotsMenuState(
            nestedFolders[i],
            nestedConversations[i],
            'hidden',
          );
        }

        await chatBarFolderAssertion.hoverAndAssertFolderDotsMenuState(
          folderWithConversations.folders,
          'hidden',
        );
        for (const conversation of folderWithConversations.conversations) {
          await chatBarFolderAssertion.hoverAndAssertFolderEntityDotsMenuState(
            folderWithConversations.folders,
            { name: conversation.name },
            'hidden',
          );
        }
        await chatBarFolderAssertion.hoverAndAssertFolderDotsMenuState(
          { name: emptyFolderName },
          'hidden',
        );

        for (const conversation of [emptyConversation, historyConversation]) {
          await conversationAssertion.hoverAndAssertEntityDotsMenuState(
            conversation,
            'hidden',
          );
        }
      },
    );

    await dialTest.step('Verify bottom buttons tooltips', async () => {
      await chatBar.selectAllButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.selectAllTooltip,
      );

      await chatBar.unselectAllButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.unselectAllTooltip,
      );

      await chatBar.deleteEntitiesButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.deleteSelectedConversationsTooltip,
      );
    });

    await dialTest.step(
      'Click on "Unselect all" button on bottom side panel and verify all folders and conversations are not checked',
      async () => {
        await chatBar.unselectAllButton.click();

        // Nested folders and conversations
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckbox(
            { name: nestedFolders[i].name },
            'hidden',
          );
          await chatBarFolderAssertion.assertFolderEntityCheckbox(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            'hidden',
          );
        }

        // Folder with two conversations
        await chatBarFolderAssertion.assertFolderCheckbox(
          { name: folderWithConversations.folders.name },
          'hidden',
        );
        for (const conversation of folderWithConversations.conversations) {
          await chatBarFolderAssertion.assertFolderEntityCheckbox(
            { name: folderWithConversations.folders.name },
            { name: conversation.name },
            'hidden',
          );
        }

        // Empty folder
        await chatBarFolderAssertion.assertFolderCheckbox(
          { name: emptyFolderName },
          'hidden',
        );

        for (const rootConversation of [
          emptyConversation,
          historyConversation,
        ]) {
          await conversationAssertion.assertEntityCheckbox(
            { name: rootConversation.name },
            'hidden',
          );
        }
      },
    );

    await dialTest.step(
      'Verify only selected conversation is highlighted',
      async () => {
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );
          await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            Colors.defaultBackground,
          );
        }
        await conversationAssertion.assertEntityBackgroundColor(
          { name: ExpectedConstants.newConversationWithIndexTitle(1) },
          expectedEntityBackgroundColor,
        );
      },
    );

    await dialTest.step(
      'Verify folders and conversations have context menu',
      async () => {
        // Nested folders and conversations
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.hoverAndAssertFolderDotsMenuState(
            nestedFolders[i],
            'visible',
          );
          await chatBarFolderAssertion.hoverAndAssertFolderEntityDotsMenuState(
            nestedFolders[i],
            nestedConversations[i],
            'visible',
          );
        }

        // Folder with two conversations
        await chatBarFolderAssertion.hoverAndAssertFolderDotsMenuState(
          folderWithConversations.folders,
          'visible',
        );
        for (const conversation of folderWithConversations.conversations) {
          await chatBarFolderAssertion.hoverAndAssertFolderEntityDotsMenuState(
            folderWithConversations.folders,
            { name: conversation.name },
            'visible',
          );
        }

        // Empty folder
        await chatBarFolderAssertion.hoverAndAssertFolderDotsMenuState(
          { name: emptyFolderName },
          'visible',
        );

        // Conversations in Today section
        for (const conversation of [emptyConversation, historyConversation]) {
          await conversationAssertion.hoverAndAssertEntityDotsMenuState(
            conversation,
            'visible',
          );
        }
      },
    );
  },
);

dialTest(
  `Cancel deleting all conversations using the 'Select all' and 'Delete selected conversations' buttons.\n` +
    `Delete all conversations using the 'Select all' and 'Delete selected conversations' buttons`,
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    chatBar,
    confirmationDialog,
    dataInjector,
    confirmationDialogAssertion,
    chatBarFolderAssertion,
    conversationAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3641', 'EPMRTC-3643');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let rootFolder: FolderConversation;
    let emptyConversation: Conversation;
    let historyConversation: Conversation;

    await dialTest.step(
      'Prepare nested folders with conversations inside each one, one more root folder with 2 conversations inside, one empty conversation and one conversation with history',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(fourNestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        rootFolder = conversationData.prepareFolderWithConversations(2);
        conversationData.resetData();

        emptyConversation = conversationData.prepareEmptyConversation();
        conversationData.resetData();

        historyConversation = conversationData.prepareDefaultConversation();

        await dataInjector.createConversations(
          [
            ...nestedConversations,
            ...rootFolder.conversations,
            emptyConversation,
            historyConversation,
          ],
          ...nestedFolders,
          rootFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Select all entities, click on "Delete selected conversations" and verify modal with confirmation is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.selectFolderEntity(
          nestedFolders[fourNestedLevels - 1].name,
          nestedConversations[fourNestedLevels - 1].name,
        );
        await folderConversations.expandFolder(rootFolder.folders.name);
        await chatBar.selectAllButton.click();
        await chatBar.deleteAllEntities();
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.deleteSelectedConversationsMessage,
        );
      },
    );

    await dialTest.step(
      'Cancel delete and verify all entities remain checked',
      async () => {
        await confirmationDialog.cancelDialog();
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            CheckboxState.checked,
          );
        }

        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: rootFolder.folders.name },
          CheckboxState.checked,
        );

        for (const rootFolderConversation of rootFolder.conversations) {
          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: rootFolder.folders.name },
            { name: rootFolderConversation.name },
            CheckboxState.checked,
          );
        }

        for (const rootConversation of [
          emptyConversation,
          historyConversation,
        ]) {
          await conversationAssertion.assertEntityCheckboxState(
            { name: rootConversation.name },
            CheckboxState.checked,
          );
        }
      },
    );

    await dialTest.step(
      'Click on "Delete selected conversations", confirmation and verify all entities are removed',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderState(
            {
              name: nestedFolders[i].name,
            },
            'hidden',
          );
          await chatBarFolderAssertion.assertFolderEntityState(
            {
              name: nestedFolders[i].name,
            },
            { name: nestedConversations[i].name },
            'hidden',
          );
        }

        await chatBarFolderAssertion.assertFolderState(
          {
            name: rootFolder.folders.name,
          },
          'hidden',
        );

        for (const rootFolderConversation of rootFolder.conversations) {
          await chatBarFolderAssertion.assertFolderEntityState(
            {
              name: rootFolder.folders.name,
            },
            { name: rootFolderConversation.name },
            'hidden',
          );
        }

        for (const rootConversation of [
          emptyConversation,
          historyConversation,
        ]) {
          await conversationAssertion.assertEntityState(
            {
              name: rootConversation.name,
            },
            'hidden',
          );
        }
      },
    );
  },
);

dialTest(
  `Clicking the 'Select' option in the root folder's context menu selects the folder with nested objects.\n` +
    `Clicking the 'Select' option in the child folder's context menu selects its nested objects and changes icon near parent.\n` +
    `Delete selected conversations using the 'Select' item in context menu and 'Delete selected conversations' button`,
  async ({
    dialHomePage,
    folderDropdownMenu,
    conversations,
    conversationData,
    folderConversations,
    chatBar,
    confirmationDialog,
    dataInjector,
    chatBarFolderAssertion,
    conversationAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3645', 'EPMRTC-3647', 'EPMRTC-3646');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let rootFolder: FolderConversation;
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step(
      'Prepare nested folders with conversations inside each one, one more root folder with 2 conversations inside and 2 single conversations',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(fourNestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        rootFolder = conversationData.prepareFolderWithConversations(2);
        conversationData.resetData();

        firstConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();

        secondConversation = conversationData.prepareDefaultConversation();

        await dataInjector.createConversations(
          [
            ...nestedConversations,
            ...rootFolder.conversations,
            firstConversation,
            secondConversation,
          ],
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
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.selectFolderEntity(
          nestedFolders[fourNestedLevels - 1].name,
          nestedConversations[fourNestedLevels - 1].name,
        );
        await folderConversations.expandFolder(rootFolder.folders.name);
        await folderConversations.openFolderDropdownMenu(nestedFolders[1].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.select);
        for (let i = 1; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            CheckboxState.checked,
          );
        }

        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[0].name },
          CheckboxState.partiallyChecked,
        );
      },
    );

    await dialTest.step('Verify other entities stay not checked', async () => {
      await chatBarFolderAssertion.assertFolderEntityCheckbox(
        { name: nestedFolders[0].name },
        { name: nestedConversations[0].name },
        'hidden',
      );
      await chatBarFolderAssertion.assertFolderCheckbox(
        {
          name: rootFolder.folders.name,
        },
        'hidden',
      );

      for (const rootFolderConversation of rootFolder.conversations) {
        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: rootFolder.folders.name },
          { name: rootFolderConversation.name },
          'hidden',
        );
      }

      for (const singleConversation of [
        firstConversation,
        secondConversation,
      ]) {
        await conversationAssertion.assertEntityCheckbox(
          {
            name: singleConversation.name,
          },
          'hidden',
        );
      }
    });

    await dialTest.step(
      'Click on 2nd single conversation and verify it becomes checked',
      async () => {
        await conversations.getEntityByName(secondConversation.name).click();
        await conversationAssertion.assertEntityCheckboxState(
          { name: secondConversation.name },
          CheckboxState.checked,
        );
      },
    );

    await dialTest.step(
      'Click on "Delete selected conversations" button at the bottom panel, confirm delete and verify only selected entities are removed',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (let i = 1; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderState(
            {
              name: nestedFolders[i].name,
            },
            'hidden',
          );
          await chatBarFolderAssertion.assertFolderEntityState(
            {
              name: nestedFolders[i].name,
            },
            { name: nestedConversations[i].name },
            'hidden',
          );
        }

        await conversationAssertion.assertEntityCheckbox(
          {
            name: secondConversation.name,
          },
          'hidden',
        );

        await chatBarFolderAssertion.assertFolderState(
          {
            name: nestedFolders[0].name,
          },
          'visible',
        );
        await chatBarFolderAssertion.assertFolderEntityState(
          { name: nestedFolders[0].name },
          { name: nestedConversations[0].name },
          'visible',
        );

        await conversationAssertion.assertEntityState(
          {
            name: firstConversation.name,
          },
          'visible',
        );
        await chatBarFolderAssertion.assertFolderState(
          {
            name: rootFolder.folders.name,
          },
          'visible',
        );

        for (const rootFolderConversation of rootFolder.conversations) {
          await chatBarFolderAssertion.assertFolderEntityState(
            { name: rootFolder.folders.name },
            { name: rootFolderConversation.name },
            'visible',
          );
        }
      },
    );
  },
);

dialTest(
  `Clicking the 'Select' option in conversation context menu changes folder's selection`,
  async ({
    dialHomePage,
    conversationDropdownMenu,
    conversationData,
    folderConversations,
    dataInjector,
    chatBarFolderAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3654');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let lowLevelFolderConversation: Conversation;
    let secondLevelFolder: FolderConversation;

    await dialTest.step(
      'Prepare nested folders with conversations inside each one, one more folder with conversation on the second level, and one more conversation on the lowest folder level',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(threeNestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        lowLevelFolderConversation =
          conversationData.prepareDefaultConversation();
        lowLevelFolderConversation.folderId =
          nestedFolders[threeNestedLevels - 1].id;
        lowLevelFolderConversation.id = `${lowLevelFolderConversation.folderId}/${lowLevelFolderConversation.id}`;
        conversationData.resetData();

        secondLevelFolder =
          conversationData.prepareDefaultConversationInFolder();
        secondLevelFolder.folders.folderId = `${nestedFolders[1].folderId}/${secondLevelFolder.folders.name}`;
        secondLevelFolder.conversations[0].folderId =
          secondLevelFolder.folders.folderId;
        secondLevelFolder.conversations[0].id = `${nestedFolders[1].folderId}/${secondLevelFolder.conversations[0].id}`;

        await dataInjector.createConversations(
          [
            ...nestedConversations,
            lowLevelFolderConversation,
            ...secondLevelFolder.conversations,
          ],
          ...nestedFolders,
          secondLevelFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Select lowest level conversation and verify it is highlighted and checked, parent folders are partially checked, rest entities remain unchecked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.selectFolderEntity(
          nestedFolders[threeNestedLevels - 1].name,
          nestedConversations[threeNestedLevels - 1].name,
        );
        await folderConversations.expandFolder(secondLevelFolder.folders.name);
        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[threeNestedLevels - 1].name,
          nestedConversations[threeNestedLevels - 1].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);

        await chatBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: nestedConversations[threeNestedLevels - 1].name },
          CheckboxState.checked,
        );

        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: nestedConversations[threeNestedLevels - 1].name },
          Colors.backgroundAccentSecondaryAlphaDark,
        );

        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.partiallyChecked,
          );
          await chatBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );
          if (i !== threeNestedLevels - 1) {
            await chatBarFolderAssertion.assertFolderEntityCheckbox(
              { name: nestedFolders[i].name },
              { name: nestedConversations[i].name },
              'hidden',
            );
            await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
              { name: nestedFolders[i].name },
              { name: nestedConversations[i].name },
              Colors.defaultBackground,
            );
          }
        }

        await chatBarFolderAssertion.assertFolderCheckbox(
          {
            name: secondLevelFolder.folders.name,
          },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: secondLevelFolder.folders.name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.conversations[0].name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.conversations[0].name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Select second lowest level conversation and verify it is highlighted and checked, direct parent folder is checked and highlighted, other parents are partially checked, rest entities remain unchecked',
      async () => {
        await folderConversations
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          )
          .click();

        await chatBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: nestedConversations[threeNestedLevels - 1].name },
          CheckboxState.checked,
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          Colors.backgroundAccentSecondaryAlphaDark,
        );

        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          CheckboxState.checked,
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          Colors.backgroundAccentSecondaryAlphaDark,
        );

        for (let i = 0; i < nestedFolders.length - 1; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.partiallyChecked,
          );
          await chatBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );

          await chatBarFolderAssertion.assertFolderEntityCheckbox(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            'hidden',
          );
          await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            Colors.defaultBackground,
          );
        }

        await chatBarFolderAssertion.assertFolderCheckbox(
          {
            name: secondLevelFolder.folders.name,
          },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: secondLevelFolder.folders.name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.conversations[0].name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.conversations[0].name },
          Colors.defaultBackground,
        );
      },
    );
  },
);

dialTest(
  `Selecting all conversations and unselecting checked items changes folder's selection.\n` +
    `Verify selection of a chat in 'selection view'`,
  async ({
    dialHomePage,
    conversationDropdownMenu,
    conversationData,
    folderConversations,
    page,
    dataInjector,
    chatBarFolderAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3663', 'EPMRTC-3649');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let lowLevelFolderConversation: Conversation;
    let secondLevelFolder: FolderConversation;

    await dialTest.step(
      'Prepare nested folders with conversations inside each one, one more folder with conversation on the second level, and one more conversation on the lowest folder level',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(threeNestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        lowLevelFolderConversation =
          conversationData.prepareDefaultConversation();
        lowLevelFolderConversation.folderId =
          nestedFolders[threeNestedLevels - 1].id;
        lowLevelFolderConversation.id = `${lowLevelFolderConversation.folderId}/${lowLevelFolderConversation.id}`;
        conversationData.resetData();

        secondLevelFolder =
          conversationData.prepareDefaultConversationInFolder();
        secondLevelFolder.folders.folderId = `${nestedFolders[1].folderId}/${secondLevelFolder.folders.name}`;
        secondLevelFolder.conversations[0].folderId =
          secondLevelFolder.folders.folderId;
        secondLevelFolder.conversations[0].id = `${nestedFolders[1].folderId}/${secondLevelFolder.conversations[0].id}`;

        await dataInjector.createConversations(
          [
            ...nestedConversations,
            lowLevelFolderConversation,
            ...secondLevelFolder.conversations,
          ],
          ...nestedFolders,
          secondLevelFolder.folders,
        );
      },
    );

    await dialTest.step(
      'Select middle and lowest level conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.selectFolderEntity(
          nestedFolders[threeNestedLevels - 1].name,
          nestedConversations[threeNestedLevels - 1].name,
        );
        await folderConversations.expandFolder(secondLevelFolder.folders.name);
        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[1].name,
          nestedConversations[1].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await folderConversations
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            nestedConversations[threeNestedLevels - 1].name,
          )
          .click();
      },
    );

    await dialTest.step(
      'Hover over second lowest level conversation and verify not-checked checkbox with highlighted borders is displayed',
      async () => {
        await folderConversations
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          )
          .hover();
        await chatBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          CheckboxState.unchecked,
        );

        await folderConversations
          .getFolderEntityCheckbox(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          )
          .hover();
        await chatBarFolderAssertion.assertFolderEntityCheckboxBorderColors(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          Colors.textAccentSecondary,
        );
      },
    );

    await dialTest.step(
      'Select second lowest level conversation and verify they are highlighted and checked, direct parent folders are checked and highlighted, rest parent folders are partially checked, rest entities remain unchecked',
      async () => {
        await folderConversations
          .getFolderEntityCheckbox(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          )
          .click();
        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[0].name },
          CheckboxState.partiallyChecked,
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[0].name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[0].name },
          { name: nestedConversations[0].name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[0].name },
          { name: nestedConversations[0].name },
          Colors.defaultBackground,
        );

        for (let i = 1; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.backgroundAccentSecondaryAlphaDark,
          );

          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            Colors.backgroundAccentSecondaryAlphaDark,
          );
        }

        await chatBarFolderAssertion.assertFolderCheckbox(
          {
            name: secondLevelFolder.folders.name,
          },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: secondLevelFolder.folders.name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.conversations[0].name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: secondLevelFolder.folders.name },
          { name: secondLevelFolder.conversations[0].name },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Unselect second lowest level conversations and verify only middle level conversation is highlighted and checked, middle level conversation direct parents are partially checked',
      async () => {
        await folderConversations
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            nestedConversations[threeNestedLevels - 1].name,
          )
          .click();
        await folderConversations
          .getFolderEntity(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          )
          .click();
        await page.mouse.move(0, 0);

        await chatBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[1].name },
          { name: nestedConversations[1].name },
          CheckboxState.checked,
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[1].name },
          { name: nestedConversations[1].name },
          Colors.backgroundAccentSecondaryAlphaDark,
        );

        for (let i = 0; i < 1; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.partiallyChecked,
          );
          await chatBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );

          if (i !== 1) {
            await chatBarFolderAssertion.assertFolderEntityCheckbox(
              { name: nestedFolders[i].name },
              { name: nestedConversations[i].name },
              'hidden',
            );
            await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
              { name: nestedFolders[i].name },
              { name: nestedConversations[i].name },
              Colors.defaultBackground,
            );
          }
        }

        await chatBarFolderAssertion.assertFolderCheckbox(
          {
            name: nestedFolders[threeNestedLevels - 1].name,
          },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          Colors.defaultBackground,
        );

        for (const folderConversation of [
          nestedConversations[threeNestedLevels - 1].name,
          lowLevelFolderConversation.name,
        ]) {
          await chatBarFolderAssertion.assertFolderEntityCheckbox(
            { name: nestedFolders[threeNestedLevels - 1].name },
            { name: folderConversation },
            'hidden',
          );
          await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
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
    `Verify selection of a chat folder in 'selection view'.\n` +
    `Verify deselection of a chat folder in 'selection view'`,
  async ({
    dialHomePage,
    conversationDropdownMenu,
    conversationData,
    folderConversations,
    dataInjector,
    chatBarFolderAssertion,
    page,
    setTestIds,
    conversations,
  }) => {
    setTestIds('EPMRTC-3664', 'EPMRTC-3648', 'EPMRTC-3652');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let lowLevelFolderConversation: Conversation;

    await dialTest.step(
      'Prepare nested folders with conversations inside each one and one more conversation on the lowest folder level',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(threeNestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        lowLevelFolderConversation =
          conversationData.prepareDefaultConversation();
        lowLevelFolderConversation.folderId =
          nestedFolders[threeNestedLevels - 1].id;
        lowLevelFolderConversation.id = `${lowLevelFolderConversation.folderId}/${lowLevelFolderConversation.id}`;

        await dataInjector.createConversations(
          [...nestedConversations, lowLevelFolderConversation],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Select middle level conversations via context menu, hover over lowest level folder and verify not-checked checkbox with borders is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(
          nestedConversations[threeNestedLevels - 1].name,
        );

        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[1].name,
          nestedConversations[1].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);

        await folderConversations
          .getFolderByName(nestedFolders[threeNestedLevels - 1].name)
          .hover();

        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          CheckboxState.unchecked,
        );
        await folderConversations
          .getFolderCheckbox(nestedFolders[threeNestedLevels - 1].name)
          .hover();
        await chatBarFolderAssertion.assertFolderCheckboxBorderColors(
          { name: nestedFolders[threeNestedLevels - 1].name },
          Colors.textAccentSecondary,
        );
      },
    );

    await dialTest.step(
      'Select middle level folder and verify its inner content is highlighted and checked, root folder is partially checked',
      async () => {
        await folderConversations
          .getFolderCheckbox(nestedFolders[1].name)
          .click();

        for (let i = 1; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.backgroundAccentSecondaryAlphaDark,
          );

          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
            { name: nestedFolders[i].name },
            { name: nestedConversations[i].name },
            Colors.backgroundAccentSecondaryAlphaDark,
          );
        }

        await chatBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          CheckboxState.checked,
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          Colors.backgroundAccentSecondaryAlphaDark,
        );

        await chatBarFolderAssertion.assertFolderCheckboxState(
          { name: nestedFolders[0].name },
          CheckboxState.partiallyChecked,
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[0].name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[0].name },
          { name: nestedConversations[0].name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[0].name },
          { name: nestedConversations[0].name },
          Colors.defaultBackground,
        );
      },
    );

    await dialTest.step(
      'Unselect lowest level folder and verify this folder with inner content are not highlighted and checked, parent folders are partially checked',
      async () => {
        await folderConversations
          .getFolderCheckbox(nestedFolders[threeNestedLevels - 1].name)
          .click();
        await page.mouse.move(0, 0);

        await chatBarFolderAssertion.assertFolderEntityCheckboxState(
          { name: nestedFolders[1].name },
          { name: nestedConversations[1].name },
          CheckboxState.checked,
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[1].name },
          { name: nestedConversations[1].name },
          Colors.backgroundAccentSecondaryAlphaDark,
        );

        for (let i = 0; i < nestedFolders.length - 1; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.partiallyChecked,
          );
          await chatBarFolderAssertion.assertFolderBackgroundColor(
            { name: nestedFolders[i].name },
            Colors.defaultBackground,
          );
        }

        await chatBarFolderAssertion.assertFolderCheckbox(
          {
            name: nestedFolders[threeNestedLevels - 1].name,
          },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: nestedConversations[threeNestedLevels - 1].name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: nestedConversations[threeNestedLevels - 1].name },
          Colors.defaultBackground,
        );

        await chatBarFolderAssertion.assertFolderEntityCheckbox(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
          'hidden',
        );
        await chatBarFolderAssertion.assertFolderEntityBackgroundColor(
          { name: nestedFolders[threeNestedLevels - 1].name },
          { name: lowLevelFolderConversation.name },
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
    conversationDropdownMenu,
    folderDropdownMenu,
    conversationData,
    conversations,
    folderConversations,
    chatBar,
    chatFilter,
    chatFilterDropdownMenu,
    dataInjector,
    chatBarAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3650');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let singleConversation: Conversation;

    await dialTest.step(
      'Prepare nested folders with conversations inside each one and one more single conversation',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(twoNestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        singleConversation = conversationData.prepareDefaultConversation();

        await dataInjector.createConversations(
          [...nestedConversations, singleConversation],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Select single conversation, unselect it and verify bottom panel does not include "select" buttons',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(
          nestedConversations[twoNestedLevels - 1].name,
        );
        await conversations.openEntityDropdownMenu(singleConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await chatBarAssertion.assertUnselectAllButtonState('visible');

        await conversations.getEntityCheckbox(singleConversation.name).click();
        await chatBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );

    await dialTest.step(
      'Select conversation in folder, unselect it and verify bottom panel does not include "select" buttons',
      async () => {
        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[twoNestedLevels - 1].name,
          nestedConversations[twoNestedLevels - 1].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await folderConversations
          .getFolderEntityCheckbox(
            nestedFolders[twoNestedLevels - 1].name,
            nestedConversations[twoNestedLevels - 1].name,
          )
          .click();
        await chatBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );

    await dialTest.step(
      'Select folder, unselect it and verify bottom panel does not include "select" buttons',
      async () => {
        await folderConversations.openFolderDropdownMenu(nestedFolders[0].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.select);
        await folderConversations
          .getFolderCheckbox(nestedFolders[0].name)
          .click();
        await chatBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );

    await dialTest.step(
      'Select single conversation, press "Create New Conversation" button and verify bottom panel does not include "select" buttons',
      async () => {
        await conversations.openEntityDropdownMenu(singleConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await chatBar.createNewConversation();
        await chatBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );

    await dialTest.step(
      'Select single conversation, set some search term and verify bottom panel does not include "select" buttons',
      async () => {
        await conversations.openEntityDropdownMenu(singleConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await chatBar.getSearch().setSearchValue('test');
        await chatBarAssertion.assertUnselectAllButtonState('hidden');
        await chatBar.getSearch().setSearchValue('');
      },
    );

    await dialTest.step(
      'Select single conversation, set Share filter to some value and verify bottom panel does not include "select" buttons',
      async () => {
        await conversations.openEntityDropdownMenu(singleConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await chatFilter.openFilterDropdownMenu();
        await chatFilterDropdownMenu.selectMenuOption(
          FilterMenuOptions.sharedByMe,
        );
        await chatBarAssertion.assertUnselectAllButtonState('hidden');
      },
    );
  },
);

dialTest(
  'Select folder from search result select only visible conversations',
  async ({
    dialHomePage,
    folderDropdownMenu,
    conversationData,
    folderConversations,
    conversations,
    dataInjector,
    chatBarFolderAssertion,
    chatBarSearch,
    chatBar,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3911');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let lowLevelFolderConversation: Conversation;
    const duplicatedConversationName =
      ExpectedConstants.newConversationWithIndexTitle(1);

    await dialTest.step(
      'Prepare nested folders with conversations inside each one and one more conversation on the lowest folder level',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(twoNestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders, {
            1: duplicatedConversationName,
            2: ExpectedConstants.newConversationWithIndexTitle(2),
          });
        conversationData.resetData();

        lowLevelFolderConversation =
          conversationData.prepareDefaultConversation(
            undefined,
            duplicatedConversationName,
          );
        lowLevelFolderConversation.folderId =
          nestedFolders[twoNestedLevels - 1].id;
        lowLevelFolderConversation.id = `${lowLevelFolderConversation.folderId}/${lowLevelFolderConversation.id}`;

        await dataInjector.createConversations(
          [...nestedConversations, lowLevelFolderConversation],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Search conversations from nested folders, select root folder and verify hierarchy checked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(
          nestedConversations[twoNestedLevels - 1].name,
        );
        await chatBarSearch.setSearchValue(duplicatedConversationName);
        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderEntityState(
            { name: nestedFolders[i].name },
            {
              name: duplicatedConversationName,
              index: twoNestedLevels - i,
            },
            'visible',
          );
        }
        await chatBarFolderAssertion.assertFolderEntityState(
          { name: nestedFolders[twoNestedLevels - 1].name },
          { name: ExpectedConstants.newConversationWithIndexTitle(2) },
          'hidden',
        );

        await folderConversations.openFolderDropdownMenu(nestedFolders[0].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.select);

        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderCheckboxState(
            { name: nestedFolders[i].name },
            CheckboxState.checked,
          );
          await chatBarFolderAssertion.assertFolderEntityCheckboxState(
            { name: nestedFolders[i].name },
            {
              name: duplicatedConversationName,
              index: twoNestedLevels - i,
            },
            CheckboxState.checked,
          );
        }
      },
    );

    await dialTest.step(
      'Click "Delete selected conversations" button, confirm and verify only selected entities are deleted',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await chatBarSearch.setSearchValue('');

        await chatBarFolderAssertion.assertFolderEntityState(
          { name: nestedFolders[twoNestedLevels - 1].name },
          { name: ExpectedConstants.newConversationWithIndexTitle(2) },
          'visible',
        );

        for (let i = 0; i < nestedFolders.length; i++) {
          await chatBarFolderAssertion.assertFolderState(
            { name: nestedFolders[i].name },
            'visible',
          );
          await chatBarFolderAssertion.assertFolderEntityState(
            { name: nestedFolders[i].name },
            {
              name: duplicatedConversationName,
              index: twoNestedLevels - i,
            },
            'hidden',
          );
        }
      },
    );
  },
);
