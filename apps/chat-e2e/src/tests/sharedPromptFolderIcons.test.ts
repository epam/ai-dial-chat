import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  FolderPrompt,
  MenuOptions,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil, ItemUtil } from '@/src/utils';

const nestedLevels = 3;

dialTest(
  'Shared icon appears in prompt folder if user open shared link.\n' +
    'Share option appears in context menu for prompt folder if there is any prompt inside.\n' +
    'Share form text differs for prompt and folder.\n' +
    'Shared icon removes in prompt folder if rename prompt folder',
  async ({
    dialHomePage,
    folderDropdownMenu,
    promptBar,
    shareModalAssertion,
    folderPrompts,
    folderDropdownMenuAssertion,
    promptBarFolderAssertion,
    promptData,
    dataInjector,
    additionalUserShareApiHelper,
    confirmationDialog,
    confirmationDialogAssertion,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1816', 'EPMRTC-2731', 'EPMRTC-1817', 'EPMRTC-2817');
    let nestedFolders: FolderInterface[];
    const sharedFolderIndex = 2;
    let shareResponse: ShareByLinkResponseModel;
    const newFolderName = GeneratorUtil.randomString(5);

    await dialTest.step(
      'Prepare nested folders hierarchy and move prompt lowest level folder',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(nestedLevels);
        const lowLevelFolderPrompt = promptData.preparePromptInFolder(
          'prompt content',
          'prompt description',
          'lowLevelPromptName',
          nestedFolders[sharedFolderIndex],
        );
        await dataInjector.createPrompts(
          lowLevelFolderPrompt.prompts,
          ...nestedFolders,
        );
        await localStorageManager.setPromptCollapsedSection(
          CollapsedSections.Organization,
          CollapsedSections.SharedWithMe,
        );
      },
    );

    await dialTest.step(
      'Open dropdown menu for prompt folders hierarchy and verify "Share" option is available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 0; i < nestedLevels; i++) {
          await folderPrompts.expandFolder(nestedFolders[i].name);
          await folderPrompts.openFolderDropdownMenu(nestedFolders[i].name);
          await folderDropdownMenuAssertion.assertMenuIncludesOptions(
            MenuOptions.share,
          );
        }
      },
    );

    await dialTest.step(
      'Add a new empty folder to a folder that gonna be shared',
      async () => {
        await promptBar.createNewFolder();
        await promptBar.drugAndDropFolderToFolder(
          ExpectedConstants.newFolderWithIndexTitle(1),
          nestedFolders[sharedFolderIndex].name,
        );
      },
    );

    await dialTest.step(
      'Select "Share" option for folder with prompt inside and verify modal window is shown',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          nestedFolders[sharedFolderIndex].name,
        );
        const shareRequestResponse =
          await folderDropdownMenu.selectShareMenuOption();
        shareResponse = shareRequestResponse!.response;
        await shareModalAssertion.assertModalState('visible');
        await shareModalAssertion.assertMessageContent(
          ExpectedConstants.sharePromptFolderText,
        );
      },
    );

    await dialTest.step(
      'Accept sharing link by another user, reload page and verify arrow icon is displayed for shared folder only',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareResponse);
        await dialHomePage.reloadPage();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await promptBarFolderAssertion.assertFolderArrowIconState(
          { name: nestedFolders[sharedFolderIndex].name },
          'visible',
        );
        await promptBarFolderAssertion.assertSharedFolderArrowIconColor(
          { name: nestedFolders[sharedFolderIndex].name },
          Colors.textSecondary,
        );
        for (let i = 0; i < nestedLevels; i++) {
          if (i !== sharedFolderIndex) {
            await promptBarFolderAssertion.assertFolderArrowIconState(
              { name: nestedFolders[i].name },
              'hidden',
            );
          }
        }
      },
    );

    await dialTest.step(
      'Edit shared folder and verify confirmation popup is displayed',
      async () => {
        await folderPrompts.openFolderDropdownMenu(
          nestedFolders[sharedFolderIndex].name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.editFolderNameWithTick(newFolderName, {
          isHttpMethodTriggered: false,
        });
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.renameSharedFolderMessage,
        );
      },
    );

    await dialTest.step(
      'Cancel popup and verify folder remained shared',
      async () => {
        await confirmationDialog.cancelDialog();
        await promptBarFolderAssertion.assertFolderArrowIconState(
          { name: nestedFolders[sharedFolderIndex].name },
          'visible',
        );
      },
    );

    //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/1927
    // await dialTest.step(
    //   'Edit shared folder, confirm and verify folder arrow icon disappears',
    //   async () => {
    //     await folderPrompts.openFolderDropdownMenu(
    //       nestedFolders[sharedFolderIndex].name,
    //     );
    //     await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
    //     await folderPrompts.editFolderNameWithTick(newFolderName, {
    //       isHttpMethodTriggered: false,
    //     });
    //     await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
    //     await promptBarFolderAssertion.assertFolderArrowIconState(
    //       { name: newFolderName },
    //       'hidden',
    //     );
    //   },
    // );
  },
);

dialTest(
  `Shared icon appears in prompt if it's located in shared folder.\n` +
    `Shared icon disappears from folder if the folder was deleted from "Shared with me" by others`,
  async ({
    dialHomePage,
    promptData,
    promptBarFolderAssertion,
    dataInjector,
    folderPrompts,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalSecondUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3166', 'EPMRTC-3161');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    const sharedFolderIndex = nestedLevels - 2;
    const sharedPromptIndex = nestedLevels - 1;

    await dialTest.step(
      'Prepare prompts inside nested folders, share middle level folder with 2 users and low level prompt with a single user',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(nestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        await dataInjector.createPrompts(nestedPrompts);

        const shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            [nestedPrompts[sharedFolderIndex]],
            true,
          );
        await additionalUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
        await additionalSecondUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
        const sharePromptByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([
            nestedPrompts[sharedPromptIndex],
          ]);
        await additionalUserShareApiHelper.acceptInvite(
          sharePromptByLinkResponse,
        );
      },
    );

    await dialTest.step(
      'Verify arrow icon is displayed only for middle level folder and lowest level prompt',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await promptBarFolderAssertion.assertFolderArrowIconState(
          { name: nestedFolders[sharedFolderIndex].name },
          'visible',
        );
        await promptBarFolderAssertion.assertFolderEntityArrowIconState(
          { name: nestedFolders[sharedPromptIndex].name },
          { name: nestedPrompts[sharedPromptIndex].name },
          'visible',
        );
        for (let i = 0; i < nestedLevels; i++) {
          if (i !== sharedFolderIndex) {
            await promptBarFolderAssertion.assertFolderArrowIconState(
              { name: nestedFolders[i].name },
              'hidden',
            );
          }
          if (i !== sharedPromptIndex) {
            await promptBarFolderAssertion.assertFolderEntityArrowIconState(
              { name: nestedFolders[i].name },
              { name: nestedPrompts[i].name },
              'hidden',
            );
          }
        }
      },
    );

    await dialTest.step(
      'Delete shared folder by one of the users and verify folder still has arrow icon',
      async () => {
        const sharedEntities =
          await additionalSecondUserShareApiHelper.listSharedWithMePrompts();
        await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities(
          sharedEntities.resources.filter(
            (e) => e.name === nestedFolders[sharedFolderIndex].name,
          ),
        );
        await dialHomePage.reloadPage();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await promptBarFolderAssertion.assertFolderArrowIconState(
          { name: nestedFolders[sharedFolderIndex].name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Delete shared folder by rest user and verify arrow icon disappears for folder',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMePrompts();
        await additionalUserShareApiHelper.deleteSharedWithMeEntities(
          sharedEntities.resources.filter(
            (e) => e.name === nestedFolders[sharedFolderIndex].name,
          ),
        );
        await dialHomePage.reloadPage();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await promptBarFolderAssertion.assertFolderArrowIconState(
          { name: nestedFolders[sharedFolderIndex].name },
          'hidden',
        );
      },
    );
  },
);

dialTest(
  `Shared icon appears in prompt in not shared folder`,
  async ({
    dialHomePage,
    promptData,
    promptBarFolderAssertion,
    dataInjector,
    folderPrompts,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3167');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[] = [];
    const sharedPromptIndex = nestedLevels - 2;

    await dialTest.step(
      'Prepare prompts inside nested folders and share middle level folder prompt',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(nestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        await dataInjector.createPrompts(nestedPrompts);

        const sharePromptByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([
            nestedPrompts[sharedPromptIndex],
          ]);
        await additionalUserShareApiHelper.acceptInvite(
          sharePromptByLinkResponse,
        );
      },
    );

    await dialTest.step(
      'Verify arrow icon is displayed only for prompt',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await promptBarFolderAssertion.assertFolderEntityArrowIconState(
          { name: nestedFolders[sharedPromptIndex].name },
          { name: nestedPrompts[sharedPromptIndex].name },
          'visible',
        );
        for (let i = 0; i < nestedLevels; i++) {
          await promptBarFolderAssertion.assertFolderArrowIconState(
            { name: nestedFolders[i].name },
            'hidden',
          );
          if (i !== sharedPromptIndex) {
            await promptBarFolderAssertion.assertFolderEntityArrowIconState(
              { name: nestedFolders[i].name },
              { name: nestedPrompts[i].name },
              'hidden',
            );
          }
        }
      },
    );
  },
);

dialTest(
  'Shared icon disappears from folder if use Unshare.\n' +
    'Shared folder disappears from Shared with me if the original was unshared',
  async ({
    dialHomePage,
    promptData,
    promptBarFolderAssertion,
    dataInjector,
    folderPrompts,
    folderDropdownMenu,
    confirmationDialog,
    confirmationDialogAssertion,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    shareApiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3169', 'EPMRTC-2806');
    let folderPrompt: FolderPrompt;

    await dialTest.step(
      'Prepare prompt inside folder and share folder',
      async () => {
        folderPrompt = promptData.preparePromptInFolder(
          GeneratorUtil.randomString(5),
        );
        await dataInjector.createPrompts(
          folderPrompt.prompts,
          folderPrompt.folders,
        );
        const sharePromptByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            folderPrompt.prompts,
            true,
          );
        await additionalUserShareApiHelper.acceptInvite(
          sharePromptByLinkResponse,
        );
      },
    );

    await dialTest.step(
      'Select "Unshare" option for shared folder and verify confirmation modal is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.expandFolder(folderPrompt.folders.name);
        await folderPrompts.openFolderDropdownMenu(folderPrompt.folders.name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.unshareFolderMessage,
        );
      },
    );

    await dialTest.step(
      'Close confirmation modal and verify arrow icon is still displayed',
      async () => {
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.unshareFolderMessage,
        );
        await confirmationDialog.cancelDialog();
        await promptBarFolderAssertion.assertFolderArrowIconState(
          { name: folderPrompt.folders.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Confirm unsharing and verify no arrow icon is displayed on folder',
      async () => {
        await folderPrompts.openFolderDropdownMenu(folderPrompt.folders.name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await promptBarFolderAssertion.assertFolderArrowIconState(
          { name: folderPrompt.folders.name },
          'hidden',
        );
      },
    );

    await dialTest.step('Verify folder is not shared any more', async () => {
      folderPrompt.folders.id =
        folderPrompt.prompts[0].folderId + ItemUtil.urlSeparator;
      const sharedEntities =
        await additionalUserShareApiHelper.listSharedWithMePrompts();
      await shareApiAssertion.assertSharedWithMeEntityState(
        sharedEntities,
        folderPrompt.folders,
        'hidden',
      );
    });
  },
);
