import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants, FolderPrompt, MenuOptions } from '@/src/testData';

dialSharedWithMeTest(
  'Shared with me. Duplicate prompt.\n' +
    'Shared with me. Move duplicated prompt to New folder',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserSharedFolderPrompts,
    additionalShareUserSharedWithMePromptDropdownMenu,
    additionalShareUserPrompts,
    additionalShareUserPromptBarFolderAssertion,
    additionalShareUserPromptDropdownMenu,
    additionalShareUserFolderPrompts,
    additionalShareUserPromptAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1872', 'EPMRTC-2037');
    let folderPrompt: FolderPrompt;
    let promptName: string;
    let shareFolderByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare folder with prompt and share it',
      async () => {
        folderPrompt = promptData.prepareDefaultPromptInFolder();
        promptName = folderPrompt.prompts[0].name;
        await dataInjector.createPrompts(
          folderPrompt.prompts,
          folderPrompt.folders,
        );
        shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            folderPrompt.prompts,
            true,
          );
        await additionalUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Select "Duplicate" option in dropdown menu for shared folder prompt and verify prompt is duplicated in Recent section',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedFolderPrompts.expandFolder(
          folderPrompt.folders.name,
        );
        await additionalShareUserSharedFolderPrompts.openFolderEntityDropdownMenu(
          folderPrompt.folders.name,
          promptName,
        );
        await additionalShareUserSharedWithMePromptDropdownMenu.selectMenuOption(
          MenuOptions.duplicate,
          { triggeredHttpMethod: 'POST' },
        );
        await additionalShareUserPromptAssertion.assertEntityState(
          { name: promptName },
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Verify prompts with incremented names are created on duplication',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await additionalShareUserSharedFolderPrompts.openFolderEntityDropdownMenu(
            folderPrompt.folders.name,
            promptName,
          );
          await additionalShareUserSharedWithMePromptDropdownMenu.selectMenuOption(
            MenuOptions.duplicate,
            { triggeredHttpMethod: 'POST' },
          );
          await additionalShareUserPromptAssertion.assertEntityState(
            { name: `${promptName} ${i}` },
            'visible',
          );
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Select "Move To -> New folder" option in dropdown menu for duplicated prompt and verify prompt is successfully moved',
      async () => {
        await additionalShareUserPrompts.openEntityDropdownMenu(
          `${promptName} 2`,
        );
        await additionalShareUserPromptDropdownMenu.selectMenuOption(
          MenuOptions.moveTo,
        );
        await additionalShareUserPromptDropdownMenu.selectMenuOption(
          MenuOptions.newFolder,
          { triggeredHttpMethod: 'POST' },
        );
        await additionalShareUserFolderPrompts.expandFolder(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await additionalShareUserPromptBarFolderAssertion.assertFolderEntityState(
          { name: ExpectedConstants.newFolderWithIndexTitle(1) },
          { name: `${promptName} 2` },
          'visible',
        );
      },
    );
  },
);
