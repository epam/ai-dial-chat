import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  ExpectedMessages,
  FilterMenuOptions,
  FolderConversation,
  MenuOptions,
  Theme,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

const fourNestedLevels = 4;
const threeNestedLevels = 3;
const twoNestedLevels = 2;

dialTest(
  `Clicking the 'Select all' button selects all folders and conversations.\n` +
    `Clicking the 'Unselect all' button unselects all folders and conversations.\n` +
    `'Select all', 'Unselect all', 'Delete selected conversations' tooltips, icons, highlight`,
  async ({
    dialHomePage,
    conversations,
    conversationData,
    folderConversations,
    chatBar,
    localStorageManager,
    dataInjector,
    tooltip,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3638', 'EPMRTC-3639', 'EPMRTC-3644');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    let rootFolder: FolderConversation;
    let emptyConversation: Conversation;
    let historyConversation: Conversation;
    let theme: string;
    let expectedCheckboxColor: string;
    let expectedEntityBackgroundColor: string;

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

        theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
        if (theme === Theme.dark) {
          expectedCheckboxColor = Colors.textAccentSecondary;
          expectedEntityBackgroundColor =
            Colors.backgroundAccentSecondaryAlphaDark;
        } else {
          expectedCheckboxColor = Colors.backgroundAccentSecondaryLight;
          expectedEntityBackgroundColor =
            Colors.backgroundAccentSecondaryAlphaLight;
        }

        await localStorageManager.setSettings(theme);
        await localStorageManager.setSelectedConversation(
          nestedConversations[fourNestedLevels - 1],
        );
      },
    );

    await dialTest.step(
      'Open app, click on "Select all" button on bottom side panel and verify all folders and conversations are checked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(rootFolder.folders.name);
        await chatBar.selectAllButton.click();

        for (let i = 0; i < nestedFolders.length; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderIsChecked,
            )
            .toBe(CheckboxState.checked);

          expect
            .soft(
              await folderConversations.getFolderEntityCheckboxState(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);
        }
        expect
          .soft(
            await folderConversations.getFolderCheckboxState(
              rootFolder.folders.name,
            ),
            ExpectedMessages.folderIsChecked,
          )
          .toBe(CheckboxState.checked);

        for (const rootFolderConversation of rootFolder.conversations) {
          expect
            .soft(
              await folderConversations.getFolderEntityCheckboxState(
                rootFolder.folders.name,
                rootFolderConversation.name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);
        }
        for (const rootConversation of [
          emptyConversation,
          historyConversation,
        ]) {
          expect
            .soft(
              await conversations.getConversationCheckboxState(
                rootConversation.name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);
        }
      },
    );

    await dialTest.step(
      'Verify checkboxes borders and color are valid, entities are highlighted',
      async () => {
        for (let i = 0; i < nestedFolders.length; i++) {
          const folderCheckboxColor =
            await folderConversations.getFolderCheckboxColor(
              nestedFolders[i].name,
            );
          expect
            .soft(folderCheckboxColor[0], ExpectedMessages.iconColorIsValid)
            .toBe(expectedCheckboxColor);

          const folderCheckboxBorderColors =
            await folderConversations.getFolderCheckboxBorderColors(
              nestedFolders[i].name,
            );
          Object.values(folderCheckboxBorderColors).forEach((borders) => {
            borders.forEach((borderColor) => {
              expect
                .soft(borderColor, ExpectedMessages.borderColorsAreValid)
                .toBe(expectedCheckboxColor);
            });
          });

          const folderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              folderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(expectedEntityBackgroundColor);

          const folderConversationCheckboxColor =
            await folderConversations.getFolderEntityCheckboxColor(
              nestedFolders[i].name,
              nestedConversations[i].name,
            );
          expect
            .soft(
              folderConversationCheckboxColor[0],
              ExpectedMessages.iconColorIsValid,
            )
            .toBe(expectedCheckboxColor);

          const folderConversationCheckboxBorderColors =
            await folderConversations.getFolderEntityCheckboxBorderColors(
              nestedFolders[i].name,
              nestedConversations[i].name,
            );
          Object.values(folderConversationCheckboxBorderColors).forEach(
            (borders) => {
              borders.forEach((borderColor) => {
                expect
                  .soft(borderColor, ExpectedMessages.borderColorsAreValid)
                  .toBe(expectedCheckboxColor);
              });
            },
          );

          const folderConversationBackgroundColor =
            await folderConversations.getFolderEntityBackgroundColor(
              nestedFolders[i].name,
              nestedConversations[i].name,
            );
          expect
            .soft(
              folderConversationBackgroundColor[0],
              ExpectedMessages.folderEntityBackgroundColorIsValid,
            )
            .toBe(expectedEntityBackgroundColor);
        }
      },
    );

    await dialTest.step(
      'Verify neither folders nor conversations have context menu',
      async () => {
        await folderConversations
          .getFolderByName(rootFolder.folders.name)
          .hover();
        await expect
          .soft(
            folderConversations.folderDotsMenu(rootFolder.folders.name),
            ExpectedMessages.dotsMenuIsHidden,
          )
          .toBeHidden();

        await conversations
          .getConversationByName(historyConversation.name)
          .hover();
        await expect
          .soft(
            conversations.getConversationDotsMenu(historyConversation.name),
            ExpectedMessages.dotsMenuIsHidden,
          )
          .toBeHidden();
      },
    );

    await dialTest.step('Verify bottom buttons tooltips', async () => {
      await chatBar.selectAllButton.hoverOver();
      expect
        .soft(
          await tooltip.getContent(),
          ExpectedMessages.tooltipContentIsValid,
        )
        .toBe(ExpectedConstants.selectAllTooltip);

      await chatBar.unselectAllButton.hoverOver();
      expect
        .soft(
          await tooltip.getContent(),
          ExpectedMessages.tooltipContentIsValid,
        )
        .toBe(ExpectedConstants.unselectAllTooltip);

      await chatBar.deleteEntitiesButton.hoverOver();
      expect
        .soft(
          await tooltip.getContent(),
          ExpectedMessages.tooltipContentIsValid,
        )
        .toBe(ExpectedConstants.deleteSelectedConversationsTooltip);
    });

    await dialTest.step(
      'Click on "Unselect all" button on bottom side panel and verify all folders and conversations are not checked',
      async () => {
        await chatBar.unselectAllButton.click();
        for (let i = 0; i < nestedFolders.length; i++) {
          await expect
            .soft(
              folderConversations.getFolderCheckbox(nestedFolders[i].name),
              ExpectedMessages.folderIsNotChecked,
            )
            .toBeHidden();

          await expect
            .soft(
              folderConversations.getFolderEntityCheckbox(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotChecked,
            )
            .toBeHidden();
        }
        await expect
          .soft(
            folderConversations.getFolderCheckbox(rootFolder.folders.name),
            ExpectedMessages.folderIsNotChecked,
          )
          .toBeHidden();

        for (const rootFolderConversation of rootFolder.conversations) {
          await expect
            .soft(
              folderConversations.getFolderEntityCheckbox(
                rootFolder.folders.name,
                rootFolderConversation.name,
              ),
              ExpectedMessages.conversationIsNotChecked,
            )
            .toBeHidden();
        }
        for (const rootConversation of [
          emptyConversation,
          historyConversation,
        ]) {
          await expect
            .soft(
              conversations.getConversationCheckbox(rootConversation.name),
              ExpectedMessages.conversationIsNotChecked,
            )
            .toBeHidden();
        }
      },
    );

    await dialTest.step(
      'Verify only selected conversation is highlighted',
      async () => {
        for (let i = 0; i < nestedFolders.length; i++) {
          const folderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              folderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(Colors.defaultBackground);

          const folderConversationBackgroundColor =
            await folderConversations.getFolderEntityBackgroundColor(
              nestedFolders[i].name,
              nestedConversations[i].name,
            );

          expect
            .soft(
              folderConversationBackgroundColor[0],
              ExpectedMessages.folderEntityBackgroundColorIsValid,
            )
            .toBe(
              i !== fourNestedLevels - 1
                ? Colors.defaultBackground
                : expectedEntityBackgroundColor,
            );
        }
      },
    );

    await dialTest.step(
      'Verify folders and conversations have context menu',
      async () => {
        await folderConversations
          .getFolderByName(rootFolder.folders.name)
          .hover();
        await expect
          .soft(
            folderConversations.folderDotsMenu(rootFolder.folders.name),
            ExpectedMessages.dotsMenuIsVisible,
          )
          .toBeVisible();

        await conversations
          .getConversationByName(historyConversation.name)
          .hover();
        await expect
          .soft(
            conversations.getConversationDotsMenu(historyConversation.name),
            ExpectedMessages.dotsMenuIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  `Cancel deleting all conversations using the 'Select all' and 'Delete selected conversations' buttons.\n` +
    `Delete all conversations using the 'Select all' and 'Delete selected conversations' buttons`,
  async ({
    dialHomePage,
    conversations,
    conversationData,
    folderConversations,
    chatBar,
    confirmationDialog,
    localStorageManager,
    dataInjector,
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

        await localStorageManager.setSelectedConversation(
          nestedConversations[fourNestedLevels - 1],
        );
      },
    );

    await dialTest.step(
      'Select all entities, click on "Delete selected conversations" and verify modal with confirmation is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(rootFolder.folders.name);
        await chatBar.selectAllButton.click();
        await chatBar.deleteAllEntities();
        expect
          .soft(
            await confirmationDialog.getConfirmationMessage(),
            ExpectedMessages.confirmationMessageIsValid,
          )
          .toBe(ExpectedConstants.deleteSelectedConversationsMessage);
      },
    );

    await dialTest.step(
      'Cancel delete and verify all entities remain checked',
      async () => {
        await confirmationDialog.cancelDialog();
        for (let i = 0; i < nestedFolders.length; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderIsChecked,
            )
            .toBe(CheckboxState.checked);

          expect
            .soft(
              await folderConversations.getFolderEntityCheckboxState(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);
        }
        expect
          .soft(
            await folderConversations.getFolderCheckboxState(
              rootFolder.folders.name,
            ),
            ExpectedMessages.folderIsChecked,
          )
          .toBe(CheckboxState.checked);

        for (const rootFolderConversation of rootFolder.conversations) {
          expect
            .soft(
              await folderConversations.getFolderEntityCheckboxState(
                rootFolder.folders.name,
                rootFolderConversation.name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);
        }
        for (const rootConversation of [
          emptyConversation,
          historyConversation,
        ]) {
          expect
            .soft(
              await conversations.getConversationCheckboxState(
                rootConversation.name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);
        }
      },
    );

    await dialTest.step(
      'Click on "Delete selected conversations", confirmation and verify all entities are removed',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        for (let i = 0; i < nestedFolders.length; i++) {
          await expect
            .soft(
              folderConversations.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderIsNotVisible,
            )
            .toBeHidden();

          await expect
            .soft(
              folderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeHidden();
        }
        await expect
          .soft(
            folderConversations.getFolderByName(rootFolder.folders.name),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();

        for (const rootFolderConversation of rootFolder.conversations) {
          await expect
            .soft(
              folderConversations.getFolderEntity(
                rootFolder.folders.name,
                rootFolderConversation.name,
              ),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeHidden();
        }
        for (const rootConversation of [
          emptyConversation,
          historyConversation,
        ]) {
          await expect
            .soft(
              conversations.getConversationByName(rootConversation.name),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeHidden();
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
    localStorageManager,
    dataInjector,
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

        await localStorageManager.setSelectedConversation(
          nestedConversations[fourNestedLevels - 1],
        );
      },
    );

    await dialTest.step(
      'Open 2nd level nested hierarchy folder context menu, choose "Select" option and verify all nested elements are checked, root folder is partially checked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(rootFolder.folders.name);
        await folderConversations.openFolderDropdownMenu(nestedFolders[1].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.select);
        for (let i = 1; i < nestedFolders.length; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderIsChecked,
            )
            .toBe(CheckboxState.checked);

          expect
            .soft(
              await folderConversations.getFolderEntityCheckboxState(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);
        }

        expect
          .soft(
            await folderConversations.getFolderCheckboxState(
              nestedFolders[0].name,
            ),
            ExpectedMessages.folderContentIsPartiallyChecked,
          )
          .toBe(CheckboxState.partiallyChecked);
      },
    );

    await dialTest.step('Verify other entities stay not checked', async () => {
      await expect
        .soft(
          folderConversations.getFolderEntityCheckbox(
            nestedFolders[0].name,
            nestedConversations[0].name,
          ),
          ExpectedMessages.conversationIsNotChecked,
        )
        .toBeHidden();

      await expect
        .soft(
          folderConversations.getFolderCheckbox(rootFolder.folders.name),
          ExpectedMessages.folderIsNotChecked,
        )
        .toBeHidden();

      for (const rootFolderConversation of rootFolder.conversations) {
        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              rootFolder.folders.name,
              rootFolderConversation.name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
      }
      for (const singleConversation of [
        firstConversation,
        secondConversation,
      ]) {
        await expect
          .soft(
            conversations.getConversationCheckbox(singleConversation.name),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
      }
    });

    await dialTest.step(
      'Click on 2nd single conversation and verify it becomes checked',
      async () => {
        await conversations
          .getConversationByName(secondConversation.name)
          .click();
        expect
          .soft(
            await conversations.getConversationCheckboxState(
              secondConversation.name,
            ),
            ExpectedMessages.conversationIsChecked,
          )
          .toBe(CheckboxState.checked);
      },
    );

    await dialTest.step(
      'Click on "Delete selected conversations" button at the bottom panel, confirm delete and verify only selected entities are removed',
      async () => {
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (let i = 1; i < nestedFolders.length; i++) {
          await expect
            .soft(
              folderConversations.getFolderByName(nestedFolders[i].name),
              ExpectedMessages.folderIsNotVisible,
            )
            .toBeHidden();

          await expect
            .soft(
              folderConversations.getFolderEntity(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotVisible,
            )
            .toBeHidden();
        }
        await expect
          .soft(
            conversations.getConversationByName(secondConversation.name),
            ExpectedMessages.conversationIsNotVisible,
          )
          .toBeHidden();

        await expect
          .soft(
            folderConversations.getFolderByName(nestedFolders[0].name),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderConversations.getFolderEntity(
              nestedFolders[0].name,
              nestedConversations[0].name,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            conversations.getConversationByName(firstConversation.name),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            folderConversations.getFolderByName(rootFolder.folders.name),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
        for (const rootFolderConversation of rootFolder.conversations) {
          await expect
            .soft(
              folderConversations.getFolderEntity(
                rootFolder.folders.name,
                rootFolderConversation.name,
              ),
              ExpectedMessages.conversationIsVisible,
            )
            .toBeVisible();
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
    localStorageManager,
    dataInjector,
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

        await localStorageManager.setSelectedConversation(
          nestedConversations[threeNestedLevels - 1],
        );
      },
    );

    await dialTest.step(
      'Select lowest level conversation and verify it is highlighted and checked, parent folders are partially checked, rest entities remain unchecked',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.expandFolder(secondLevelFolder.folders.name);
        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[threeNestedLevels - 1].name,
          nestedConversations[threeNestedLevels - 1].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);

        expect
          .soft(
            await folderConversations.getFolderEntityCheckboxState(
              nestedFolders[threeNestedLevels - 1].name,
              nestedConversations[threeNestedLevels - 1].name,
            ),
            ExpectedMessages.conversationIsChecked,
          )
          .toBe(CheckboxState.checked);

        const checkedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
            nestedConversations[threeNestedLevels - 1].name,
          );
        expect
          .soft(
            checkedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentSecondaryAlphaDark);

        for (let i = 0; i < nestedFolders.length; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderContentIsPartiallyChecked,
            )
            .toBe(CheckboxState.partiallyChecked);
          const partiallyCheckedFolderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              partiallyCheckedFolderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(Colors.defaultBackground);

          if (i !== threeNestedLevels - 1) {
            await expect
              .soft(
                folderConversations.getFolderEntityCheckbox(
                  nestedFolders[i].name,
                  nestedConversations[i].name,
                ),
                ExpectedMessages.conversationIsNotChecked,
              )
              .toBeHidden();
            const uncheckedConversationBackgroundColor =
              await folderConversations.getFolderEntityBackgroundColor(
                nestedFolders[i].name,
                nestedConversations[i].name,
              );
            expect
              .soft(
                uncheckedConversationBackgroundColor[0],
                ExpectedMessages.folderEntityBackgroundColorIsValid,
              )
              .toBe(Colors.defaultBackground);
          }
        }

        await expect
          .soft(
            folderConversations.getFolderCheckbox(
              secondLevelFolder.folders.name,
            ),
            ExpectedMessages.folderIsNotChecked,
          )
          .toBeHidden();
        const uncheckedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            secondLevelFolder.folders.name,
          );
        expect
          .soft(
            uncheckedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              secondLevelFolder.folders.name,
              secondLevelFolder.conversations[0].name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        let uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            secondLevelFolder.folders.name,
            secondLevelFolder.conversations[0].name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              nestedFolders[threeNestedLevels - 1].name,
              lowLevelFolderConversation.name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);
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

        expect
          .soft(
            await folderConversations.getFolderEntityCheckboxState(
              nestedFolders[threeNestedLevels - 1].name,
              lowLevelFolderConversation.name,
            ),
            ExpectedMessages.conversationIsChecked,
          )
          .toBe(CheckboxState.checked);

        const checkedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          );
        expect
          .soft(
            checkedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentSecondaryAlphaDark);

        expect
          .soft(
            await folderConversations.getFolderCheckboxState(
              nestedFolders[threeNestedLevels - 1].name,
            ),
            ExpectedMessages.folderIsChecked,
          )
          .toBe(CheckboxState.checked);
        const checkedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
          );
        expect
          .soft(
            checkedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentSecondaryAlphaDark);

        for (let i = 0; i < nestedFolders.length - 1; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderContentIsPartiallyChecked,
            )
            .toBe(CheckboxState.partiallyChecked);
          const partiallyCheckedFolderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              partiallyCheckedFolderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(Colors.defaultBackground);

          await expect
            .soft(
              folderConversations.getFolderEntityCheckbox(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsNotChecked,
            )
            .toBeHidden();
          const uncheckedConversationBackgroundColor =
            await folderConversations.getFolderEntityBackgroundColor(
              nestedFolders[i].name,
              nestedConversations[i].name,
            );
          expect
            .soft(
              uncheckedConversationBackgroundColor[0],
              ExpectedMessages.folderEntityBackgroundColorIsValid,
            )
            .toBe(Colors.defaultBackground);
        }

        await expect
          .soft(
            folderConversations.getFolderCheckbox(
              secondLevelFolder.folders.name,
            ),
            ExpectedMessages.folderIsNotChecked,
          )
          .toBeHidden();
        const uncheckedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            secondLevelFolder.folders.name,
          );
        expect
          .soft(
            uncheckedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              secondLevelFolder.folders.name,
              secondLevelFolder.conversations[0].name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        const uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            secondLevelFolder.folders.name,
            secondLevelFolder.conversations[0].name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);
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
    localStorageManager,
    page,
    dataInjector,
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

        await localStorageManager.setSelectedConversation(
          nestedConversations[threeNestedLevels - 1],
        );
      },
    );

    await dialTest.step(
      'Select middle and lowest level conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
        expect
          .soft(
            await folderConversations.getFolderEntityCheckboxState(
              nestedFolders[threeNestedLevels - 1].name,
              lowLevelFolderConversation.name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBe(CheckboxState.unchecked);

        await folderConversations
          .getFolderEntityCheckbox(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          )
          .hover();
        const conversationCheckboxBorderColors =
          await folderConversations.getFolderEntityCheckboxBorderColors(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          );
        Object.values(conversationCheckboxBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.borderColorsAreValid)
              .toBe(Colors.textAccentSecondary);
          });
        });
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
        expect
          .soft(
            await folderConversations.getFolderCheckboxState(
              nestedFolders[0].name,
            ),
            ExpectedMessages.folderContentIsPartiallyChecked,
          )
          .toBe(CheckboxState.partiallyChecked);
        const partiallyCheckedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            nestedFolders[0].name,
          );
        expect
          .soft(
            partiallyCheckedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              nestedFolders[0].name,
              nestedConversations[0].name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        let uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[0].name,
            nestedConversations[0].name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        for (let i = 1; i < nestedFolders.length; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderIsChecked,
            )
            .toBe(CheckboxState.checked);
          const checkedFolderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              checkedFolderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(Colors.backgroundAccentSecondaryAlphaDark);

          expect
            .soft(
              await folderConversations.getFolderEntityCheckboxState(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);

          const checkedConversationBackgroundColor =
            await folderConversations.getFolderEntityBackgroundColor(
              nestedFolders[i].name,
              nestedConversations[i].name,
            );
          expect
            .soft(
              checkedConversationBackgroundColor[0],
              ExpectedMessages.folderEntityBackgroundColorIsValid,
            )
            .toBe(Colors.backgroundAccentSecondaryAlphaDark);
        }

        await expect
          .soft(
            folderConversations.getFolderCheckbox(
              secondLevelFolder.folders.name,
            ),
            ExpectedMessages.folderIsNotChecked,
          )
          .toBeHidden();
        const uncheckedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            secondLevelFolder.folders.name,
          );
        expect
          .soft(
            uncheckedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              secondLevelFolder.folders.name,
              secondLevelFolder.conversations[0].name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            secondLevelFolder.folders.name,
            secondLevelFolder.conversations[0].name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);
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

        expect
          .soft(
            await folderConversations.getFolderEntityCheckboxState(
              nestedFolders[1].name,
              nestedConversations[1].name,
            ),
            ExpectedMessages.conversationIsChecked,
          )
          .toBe(CheckboxState.checked);

        const checkedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[1].name,
            nestedConversations[1].name,
          );
        expect
          .soft(
            checkedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentSecondaryAlphaDark);

        for (let i = 0; i < 1; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderContentIsPartiallyChecked,
            )
            .toBe(CheckboxState.partiallyChecked);
          const partiallyCheckedFolderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              partiallyCheckedFolderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(Colors.defaultBackground);

          if (i !== 1) {
            await expect
              .soft(
                folderConversations.getFolderEntityCheckbox(
                  nestedFolders[i].name,
                  nestedConversations[i].name,
                ),
                ExpectedMessages.conversationIsNotChecked,
              )
              .toBeHidden();
            const uncheckedConversationBackgroundColor =
              await folderConversations.getFolderEntityBackgroundColor(
                nestedFolders[i].name,
                nestedConversations[i].name,
              );
            expect
              .soft(
                uncheckedConversationBackgroundColor[0],
                ExpectedMessages.folderEntityBackgroundColorIsValid,
              )
              .toBe(Colors.defaultBackground);
          }
        }

        await expect
          .soft(
            folderConversations.getFolderCheckbox(
              nestedFolders[threeNestedLevels - 1].name,
            ),
            ExpectedMessages.folderIsNotChecked,
          )
          .toBeHidden();
        const uncheckedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
          );
        expect
          .soft(
            uncheckedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        for (const folderConversation of [
          nestedConversations[threeNestedLevels - 1].name,
          lowLevelFolderConversation.name,
        ]) {
          await expect
            .soft(
              folderConversations.getFolderEntityCheckbox(
                nestedFolders[threeNestedLevels - 1].name,
                folderConversation,
              ),
              ExpectedMessages.conversationIsNotChecked,
            )
            .toBeHidden();
          const uncheckedConversationBackgroundColor =
            await folderConversations.getFolderEntityBackgroundColor(
              nestedFolders[threeNestedLevels - 1].name,
              folderConversation,
            );
          expect
            .soft(
              uncheckedConversationBackgroundColor[0],
              ExpectedMessages.folderEntityBackgroundColorIsValid,
            )
            .toBe(Colors.defaultBackground);
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
    localStorageManager,
    dataInjector,
    page,
    setTestIds,
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

        await localStorageManager.setSelectedConversation(
          nestedConversations[threeNestedLevels - 1],
        );
      },
    );

    await dialTest.step(
      'Select middle level conversations via context menu, hover over lowest level folder and verify not-checked checkbox with borders is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        await folderConversations.openFolderEntityDropdownMenu(
          nestedFolders[1].name,
          nestedConversations[1].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);

        await folderConversations
          .getFolderByName(nestedFolders[threeNestedLevels - 1].name)
          .hover();
        expect
          .soft(
            await folderConversations.getFolderCheckboxState(
              nestedFolders[threeNestedLevels - 1].name,
            ),
            ExpectedMessages.folderIsNotChecked,
          )
          .toBe(CheckboxState.unchecked);

        await folderConversations
          .getFolderCheckbox(nestedFolders[threeNestedLevels - 1].name)
          .hover();
        const folderCheckboxBorderColors =
          await folderConversations.getFolderCheckboxBorderColors(
            nestedFolders[threeNestedLevels - 1].name,
          );
        Object.values(folderCheckboxBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.borderColorsAreValid)
              .toBe(Colors.textAccentSecondary);
          });
        });
      },
    );

    await dialTest.step(
      'Select middle level folder and verify its inner content is highlighted and checked, root folder is partially checked',
      async () => {
        await folderConversations
          .getFolderCheckbox(nestedFolders[1].name)
          .click();

        for (let i = 1; i < nestedFolders.length; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderIsChecked,
            )
            .toBe(CheckboxState.checked);
          const checkedFolderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              checkedFolderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(Colors.backgroundAccentSecondaryAlphaDark);

          expect
            .soft(
              await folderConversations.getFolderEntityCheckboxState(
                nestedFolders[i].name,
                nestedConversations[i].name,
              ),
              ExpectedMessages.conversationIsChecked,
            )
            .toBe(CheckboxState.checked);

          const checkedConversationBackgroundColor =
            await folderConversations.getFolderEntityBackgroundColor(
              nestedFolders[i].name,
              nestedConversations[i].name,
            );
          expect
            .soft(
              checkedConversationBackgroundColor[0],
              ExpectedMessages.folderEntityBackgroundColorIsValid,
            )
            .toBe(Colors.backgroundAccentSecondaryAlphaDark);
        }

        expect
          .soft(
            await folderConversations.getFolderEntityCheckboxState(
              nestedFolders[threeNestedLevels - 1].name,
              lowLevelFolderConversation.name,
            ),
            ExpectedMessages.conversationIsChecked,
          )
          .toBe(CheckboxState.checked);

        const checkedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          );
        expect
          .soft(
            checkedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentSecondaryAlphaDark);

        expect
          .soft(
            await folderConversations.getFolderCheckboxState(
              nestedFolders[0].name,
            ),
            ExpectedMessages.folderContentIsPartiallyChecked,
          )
          .toBe(CheckboxState.partiallyChecked);
        const partiallyCheckedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            nestedFolders[0].name,
          );
        expect
          .soft(
            partiallyCheckedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              nestedFolders[0].name,
              nestedConversations[0].name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        const uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[0].name,
            nestedConversations[0].name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);
      },
    );

    await dialTest.step(
      'Unselect lowest level folder and verify this folder with inner content are not highlighted and checked, parent folders are partially checked',
      async () => {
        await folderConversations
          .getFolderCheckbox(nestedFolders[threeNestedLevels - 1].name)
          .click();
        await page.mouse.move(0, 0);

        expect
          .soft(
            await folderConversations.getFolderEntityCheckboxState(
              nestedFolders[1].name,
              nestedConversations[1].name,
            ),
            ExpectedMessages.conversationIsChecked,
          )
          .toBe(CheckboxState.checked);

        const checkedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[1].name,
            nestedConversations[1].name,
          );
        expect
          .soft(
            checkedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.backgroundAccentSecondaryAlphaDark);

        for (let i = 0; i < nestedFolders.length - 1; i++) {
          expect
            .soft(
              await folderConversations.getFolderCheckboxState(
                nestedFolders[i].name,
              ),
              ExpectedMessages.folderContentIsPartiallyChecked,
            )
            .toBe(CheckboxState.partiallyChecked);
          const partiallyCheckedFolderBackgroundColor =
            await folderConversations.getFolderBackgroundColor(
              nestedFolders[i].name,
            );
          expect
            .soft(
              partiallyCheckedFolderBackgroundColor[0],
              ExpectedMessages.folderBackgroundColorIsValid,
            )
            .toBe(Colors.defaultBackground);
        }

        await expect
          .soft(
            folderConversations.getFolderCheckbox(
              nestedFolders[threeNestedLevels - 1].name,
            ),
            ExpectedMessages.folderIsNotChecked,
          )
          .toBeHidden();
        const uncheckedFolderBackgroundColor =
          await folderConversations.getFolderBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
          );
        expect
          .soft(
            uncheckedFolderBackgroundColor[0],
            ExpectedMessages.folderBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              nestedFolders[threeNestedLevels - 1].name,
              nestedConversations[threeNestedLevels - 1].name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        let uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
            nestedConversations[threeNestedLevels - 1].name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);

        await expect
          .soft(
            folderConversations.getFolderEntityCheckbox(
              nestedFolders[threeNestedLevels - 1].name,
              lowLevelFolderConversation.name,
            ),
            ExpectedMessages.conversationIsNotChecked,
          )
          .toBeHidden();
        uncheckedConversationBackgroundColor =
          await folderConversations.getFolderEntityBackgroundColor(
            nestedFolders[threeNestedLevels - 1].name,
            lowLevelFolderConversation.name,
          );
        expect
          .soft(
            uncheckedConversationBackgroundColor[0],
            ExpectedMessages.folderEntityBackgroundColorIsValid,
          )
          .toBe(Colors.defaultBackground);
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
    localStorageManager,
    dataInjector,
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

        await localStorageManager.setSelectedConversation(
          nestedConversations[twoNestedLevels - 1],
        );
      },
    );

    await dialTest.step(
      'Select single conversation, unselect it and verify bottom panel does not include "select" buttons',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(
          singleConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await expect
          .soft(
            chatBar.unselectAllButton.getElementLocator(),
            ExpectedMessages.buttonIsNotVisible,
          )
          .toBeVisible();

        await conversations
          .getConversationCheckbox(singleConversation.name)
          .click();
        await expect
          .soft(
            chatBar.unselectAllButton.getElementLocator(),
            ExpectedMessages.buttonIsNotVisible,
          )
          .toBeHidden();
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
        await expect
          .soft(
            chatBar.unselectAllButton.getElementLocator(),
            ExpectedMessages.buttonIsNotVisible,
          )
          .toBeHidden();
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
        await expect
          .soft(
            chatBar.unselectAllButton.getElementLocator(),
            ExpectedMessages.buttonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Select single conversation, press "Create New Conversation" button and verify bottom panel does not include "select" buttons',
      async () => {
        await conversations.openConversationDropdownMenu(
          singleConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await chatBar.createNewConversation();
        await expect
          .soft(
            chatBar.unselectAllButton.getElementLocator(),
            ExpectedMessages.buttonIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Select single conversation, set some search term and verify bottom panel does not include "select" buttons',
      async () => {
        await conversations.openConversationDropdownMenu(
          singleConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await chatBar.getSearch().setSearchValue('test');
        await expect
          .soft(
            chatBar.unselectAllButton.getElementLocator(),
            ExpectedMessages.buttonIsNotVisible,
          )
          .toBeHidden();
        await chatBar.getSearch().setSearchValue('');
      },
    );

    await dialTest.step(
      'Select single conversation, set Share filter to some value and verify bottom panel does not include "select" buttons',
      async () => {
        await conversations.openConversationDropdownMenu(
          singleConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.select);
        await chatFilter.openFilterDropdownMenu();
        await chatFilterDropdownMenu.selectMenuOption(
          FilterMenuOptions.sharedByMe,
        );
        await expect
          .soft(
            chatBar.unselectAllButton.getElementLocator(),
            ExpectedMessages.buttonIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);
