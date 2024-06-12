import { FolderPrompts } from '../ui/webElements';

import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  FolderPrompt,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Prompt folder: default numeration',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1621');

    await dialTest.step(
      'Create several new prompt folders and verify their names are incremented',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i <= 3; i++) {
          await promptBar.createNewFolder();
          await expect
            .soft(
              folderPrompts.getFolderByName(
                ExpectedConstants.newPromptFolderWithIndexTitle(i),
              ),
              ExpectedMessages.folderIsVisible,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  'Prompt folder: folder created from Move to is counted into default numeration',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    prompts,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    promptModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1623');
    let prompt: Prompt;
    let folderNumber = 1;
    // let folder: Fold;

    await dialTest.step('Preparation', async () => {
      prompt = promptData.preparePrompt('{{A}} + {{B}}', 'Prompt description');
      await dataInjector.createPrompts([prompt]);
    });

    await dialTest.step('Create a new folder', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await promptBar.createNewFolder();
      await expect
        .soft(
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber),
          ),
          ExpectedMessages.folderIsVisible,
        )
        .toBeVisible();
    });

    await dialTest.step('Move the prompt to the new folder', async () => {
      await prompts.openPromptDropdownMenu(prompt.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
      await promptDropdownMenu.selectMenuOption(
        ExpectedConstants.newFolderTitle,
      );

      await folderPrompts.expandFolder(
        ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber + 1),
      );
      await expect(
        //TODO replace with soft
        folderPrompts.getFolderEntity(
          ExpectedConstants.newFolderWithIndexTitle(folderNumber + 1),
          prompt.name,
        ),
        ExpectedMessages.newFolderCreated,
      ).toBeVisible();
    });
  },
);

dialTest(
  'Prompt folder: renamed and deleted folders are not counted into prompt folder numeration',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1622');
    let folderNumber = 1;

    await dialTest.step(
      'Create several new prompt folders and verify their names are incremented',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (folderNumber = 1; folderNumber < 3; folderNumber++) {
          await promptBar.createNewFolder();
          await expect
            .soft(
              folderPrompts.getFolderByName(
                ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber),
              ),
              ExpectedMessages.folderIsVisible,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Delete the first folder and create a new one',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();
        await expect(
          await folderPrompts.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(1),
          ),
          ExpectedMessages.folderDeleted,
        ).toBeHidden();

        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Rename the fourth folder and create a new one',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(folderNumber),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderNameWithTick('Renamed Folder');

        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(folderNumber),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);

dialTest(
  'Prompt folder: numeration continues after 999',
  async ({
    dialHomePage,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2967');

    await dialTest.step('Create a new folder', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await promptBar.createNewFolder();
      await expect
        .soft(
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(1),
          ),
          ExpectedMessages.folderIsVisible,
        )
        .toBeVisible();
    });

    await dialTest.step('Rename the folder to 999', async () => {
      await folderPrompts.openFolderDropdownMenu(
        ExpectedConstants.newFolderWithIndexTitle(1),
      );
      await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
      await folderPrompts.editFolderNameWithTick(
        ExpectedConstants.newPromptFolderWithIndexTitle(999),
      );
    });

    await dialTest.step('Create a new folder', async () => {
      for (let i = 1000; i <= 1002; i++) {
        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      }
    });
  },
);

dialTest.only(
  'Prompt folder: names can be equal on different levels',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    promptBar,
    folderPrompts,
    promptDropdownMenu,
    confirmationDialog,
    setTestIds,
    prompts,
  }) => {
    setTestIds('EPMRTC-2968');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    const duplicatedFolderName = 'Duplicated Name';

    await dialTest.step('Create four folders', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      for (let i = 1; i <= 3; i++) {
        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      }
    });

    await dialTest.step('Create nested folder hierarchy', async () => {
      await promptBar.dragAndDropEntityToFolder(
        folderPrompts.getFolderByName(
          ExpectedConstants.newPromptFolderWithIndexTitle(3),
        ),
        folderPrompts.getFolderByName(
          ExpectedConstants.newPromptFolderWithIndexTitle(2),
        ),
      );
      await promptBar.dragAndDropEntityToFolder(
        folderPrompts.getFolderByName(
          ExpectedConstants.newPromptFolderWithIndexTitle(2),
        ),
        folderPrompts.getFolderByName(
          ExpectedConstants.newPromptFolderWithIndexTitle(1),
        ),
      );
      await folderPrompts.expandFolder(
        ExpectedConstants.newPromptFolderWithIndexTitle(2),
      );
      await folderPrompts.expandFolder(
        ExpectedConstants.newPromptFolderWithIndexTitle(3),
      );
    });

    await dialTest.step('Rename all folders to the same name', async () => {
      for (let i = 1; i <= 3; i++) {
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(i),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderNameWithTick(duplicatedFolderName);
        await expect(
          await folderPrompts.getFolderByName(duplicatedFolderName, i),
          ExpectedMessages.folderNameUpdated,
        ).toBeVisible();
      }
    });
  },
);
