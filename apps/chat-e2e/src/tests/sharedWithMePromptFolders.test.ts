import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants, FolderPrompt, MenuOptions } from '@/src/testData';
import { GeneratorUtil, ItemUtil } from '@/src/utils';
import { Entity } from '@epam/ai-dial-shared';

const nestedLevels = 4;

dialSharedWithMeTest(
  'Shared with me. Share prompt in Folder.\n' +
    'Shared with me. Share single prompt and share prompt folder separately. Created two different structures.\n' +
    'Shared with me. Prompt folder with special chars in the name',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserSharedFolderPromptsAssertions,
    additionalShareUserPromptPreviewModal,
    additionalShareUserSharedWithMePromptAssertion,
    additionalShareUserSharedPromptPreviewModalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1858', 'EPMRTC-1861', 'EPMRTC-3182');
    let folderPrompt: FolderPrompt;
    let sharePromptByLinkResponse: ShareByLinkResponseModel;
    let shareFolderByLinkResponse: ShareByLinkResponseModel;
    const promptName = GeneratorUtil.randomString(5);
    const folderName = `Folder ${ExpectedConstants.allowedSpecialChars}`;

    await dialSharedWithMeTest.step(
      'Prepare folder with special charts in the name and put prompt inside',
      async () => {
        folderPrompt = promptData.prepareDefaultPromptInFolder(
          promptName,
          folderName,
        );
        await dataInjector.createPrompts(
          folderPrompt.prompts,
          folderPrompt.folders,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Prepare separate share links for prompt and folder',
      async () => {
        sharePromptByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(folderPrompt.prompts);
        shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            folderPrompt.prompts,
            true,
          );
      },
    );

    await dialSharedWithMeTest.step(
      'Accept share folder link and verify folder stays under expanded "Shared with me" section',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareFolderByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserPromptPreviewModal.closeButton.click();
        await additionalShareUserSharedFolderPromptsAssertions.assertFolderEntityState(
          { name: folderName },
          { name: promptName },
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Accept share prompt link and verify single prompt stays under expanded "Shared with me" section and prompt details popup is opened',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            sharePromptByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserPromptPreviewModal.closeButton.click();
        await additionalShareUserSharedWithMePromptAssertion.assertEntityState(
          { name: promptName },
          'visible',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. Share prompt Folder in the middle.\n' +
    'Shared with me. Folder with folder/prompt inside is deleted.\n' +
    'Shared with me. Prompt structure creates again if it was deleted if to open the same link',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserSharedFolderPromptsAssertions,
    additionalShareUserPromptPreviewModal,
    additionalShareUserSharedPromptPreviewModalAssertion,
    additionalShareUserSharedFolderPrompts,
    additionalShareUserSharedWithMeFolderDropdownMenu,
    additionalShareUserConfirmationDialog,
    setTestIds,
  }) => {
    dialSharedWithMeTest.slow();
    setTestIds('EPMRTC-1860', 'EPMRTC-1866', 'EPMRTC-1863');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    let shareFolderByLinkResponse: ShareByLinkResponseModel;
    const sharedFolderIndex = nestedLevels - 2;

    await dialSharedWithMeTest.step(
      'Prepare folders hierarchy with prompts on every level',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(nestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        await dataInjector.createPrompts(nestedPrompts, ...nestedFolders);
      },
    );

    await dialSharedWithMeTest.step(
      'Share middle level folder and accept link by another user',
      async () => {
        shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            [nestedPrompts[sharedFolderIndex]],
            true,
          );
      },
    );

    await dialSharedWithMeTest.step(
      'Accept share folder link and verify shared folder prompt preview modal is opened',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareFolderByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalTitle(
          nestedPrompts[sharedFolderIndex].name,
        );
        await additionalShareUserPromptPreviewModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify only shared folder with nested structure stays under expanded "Shared with me" section',
      async () => {
        for (let i = 0; i < nestedLevels; i++) {
          if (i === sharedFolderIndex || i === sharedFolderIndex + 1) {
            await additionalShareUserSharedFolderPromptsAssertions.assertFolderEntityState(
              { name: nestedFolders[i].name },
              { name: nestedPrompts[i].name },
              'visible',
            );
          } else {
            await additionalShareUserSharedFolderPromptsAssertions.assertFolderState(
              { name: nestedFolders[i].name },
              'hidden',
            );
          }
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Delete folder from "Shared with me" section, refresh page and verify folder is not restored',
      async () => {
        await additionalShareUserSharedFolderPrompts.openFolderDropdownMenu(
          nestedFolders[sharedFolderIndex].name,
        );
        await additionalShareUserSharedWithMeFolderDropdownMenu.selectMenuOption(
          MenuOptions.delete,
        );
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        for (let i = sharedFolderIndex; i <= sharedFolderIndex + 1; i++) {
          await additionalShareUserSharedFolderPromptsAssertions.assertFolderState(
            { name: nestedFolders[i].name },
            'hidden',
          );
        }

        await additionalShareUserDialHomePage.reloadPage();
        for (let i = sharedFolderIndex; i <= sharedFolderIndex + 1; i++) {
          await additionalShareUserSharedFolderPromptsAssertions.assertFolderState(
            { name: nestedFolders[i].name },
            'hidden',
          );
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Navigate to share folder link again and verify folder is re-shared',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareFolderByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalTitle(
          nestedPrompts[sharedFolderIndex].name,
        );
        await additionalShareUserPromptPreviewModal.closeButton.click();
        for (let i = sharedFolderIndex; i <= sharedFolderIndex + 1; i++) {
          await additionalShareUserSharedFolderPromptsAssertions.assertFolderEntityState(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            'visible',
          );
        }
      },
    );
  },
);

dialSharedWithMeTest(
  `Shared with me. Share root prompt Folder.\n` +
    `When open link with shared prompt folder from nested structure, dialog about 'root' prompt from the root folder should be shown.\n` +
    `Shared with me. No delete option in context menu for prompt/folder inside shared folder`,
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserSharedFolderPromptsAssertions,
    additionalShareUserPromptPreviewModal,
    additionalShareUserSharedPromptPreviewModalAssertion,
    additionalShareUserSharedFolderPrompts,
    additionalShareUserPromptsDropdownMenuAssertion,
    additionalShareUserFolderDropdownMenuAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1859', 'EPMRTC-3110', 'EPMRTC-1865');
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    let shareFolderByLinkResponse: ShareByLinkResponseModel;
    const sharedFolderIndex = 0;

    await dialSharedWithMeTest.step(
      'Prepare folders hierarchy with prompts on every level',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(nestedLevels);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        await dataInjector.createPrompts(nestedPrompts, ...nestedFolders);
      },
    );

    await dialSharedWithMeTest.step(
      'Share root level folder and accept link by another user',
      async () => {
        shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            [nestedPrompts[sharedFolderIndex]],
            true,
          );
      },
    );

    await dialSharedWithMeTest.step(
      'Accept share folder link and verify shared folder prompt preview modal is opened',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareFolderByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalTitle(
          nestedPrompts[sharedFolderIndex].name,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptName(
          nestedPrompts[sharedFolderIndex].name,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptDescription(
          nestedPrompts[sharedFolderIndex].description,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptContent(
          nestedPrompts[sharedFolderIndex].content!,
        );
        await additionalShareUserPromptPreviewModal.closeButton.click();
      },
    );

    await dialSharedWithMeTest.step(
      'Verify the whole folders structure with prompts stays under expanded "Shared with me" section',
      async () => {
        for (let i = 0; i < nestedLevels; i++) {
          await additionalShareUserSharedFolderPromptsAssertions.assertFolderEntityState(
            { name: nestedFolders[i].name },
            { name: nestedPrompts[i].name },
            'visible',
          );
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Verify dropdown menu with "Delete" option is available only for root level folder',
      async () => {
        for (let i = 0; i < nestedLevels; i++) {
          if (i === sharedFolderIndex) {
            await additionalShareUserSharedFolderPrompts.openFolderDropdownMenu(
              nestedFolders[i].name,
            );
            await additionalShareUserFolderDropdownMenuAssertion.assertMenuIncludesOptions(
              MenuOptions.delete,
            );
          } else {
            await additionalShareUserSharedFolderPromptsAssertions.assertFolderDotsMenuState(
              { name: nestedFolders[i].name },
              'hidden',
            );
          }
        }
      },
    );

    await dialSharedWithMeTest.step(
      'Verify no "Delete" option is available in prompts dropdown menu',
      async () => {
        for (let i = 0; i < nestedLevels; i++) {
          await additionalShareUserSharedFolderPrompts.openFolderEntityDropdownMenu(
            nestedFolders[i].name,
            nestedPrompts[i].name,
          );
          await additionalShareUserPromptsDropdownMenuAssertion.assertMenuExcludesOptions(
            MenuOptions.delete,
          );
        }
      },
    );
  },
);

dialSharedWithMeTest(
  'Shared with me. The folder structure is visible if share folder structure with prompt inside.\n' +
    'Shared with me. Prompt structure appears only once if to open the same link several times.\n' +
    'Shared with me. Use shared with me prompt in input box' +
    'Shared prompt folder structure is updated if to remove prompt from original folder',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    itemApiHelper,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserSharedFolderPromptsAssertions,
    additionalShareUserSharedFolderPrompts,
    additionalShareUserSendMessage,
    additionalShareUserSendMessageAssertion,
    shareApiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2033', 'EPMRTC-1862', 'EPMRTC-3500', 'EPMRTC-1864');
    let folderPrompt: FolderPrompt;
    let folder: FolderInterface;
    let prompt: Prompt;
    let shareFolderByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step(
      'Prepare folder with prompt inside and share it',
      async () => {
        folderPrompt = promptData.prepareDefaultPromptInFolder();
        await dataInjector.createPrompts(
          folderPrompt.prompts,
          folderPrompt.folders,
        );
        shareFolderByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink(
            folderPrompt.prompts,
            true,
          );
        folder = folderPrompt.folders;
        prompt = folderPrompt.prompts[0];
      },
    );

    await dialSharedWithMeTest.step(
      'Accept share folder link twice and verify shared folder is not duplicated',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
        await additionalUserShareApiHelper.acceptInvite(
          shareFolderByLinkResponse,
        );
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMePrompts();
        folder.id = prompt.folderId + ItemUtil.urlSeparator;
        await shareApiAssertion.assertSharedWithMeEntitiesCount(
          sharedEntities,
          folder,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Open Dial home page and verify shared folder is not duplicated',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedFolderPrompts.expandFolder(folder.name);
        await additionalShareUserSharedFolderPromptsAssertions.assertFolderEntityState(
          { name: folder.name },
          { name: prompt.name },
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Create new conversation, type "/" in the request field, select shared prompt and verify it is applied',
      async () => {
        await additionalShareUserSendMessage.messageInput.fillInInput('/');
        await additionalShareUserSendMessage
          .getPromptList()
          .selectPromptWithKeyboard(prompt.name, {
            triggeredHttpMethod: 'GET',
          });
        await additionalShareUserSendMessageAssertion.assertMessageValue(
          prompt.content,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Move prompt out of shared folder by main user',
      async () => {
        const promptBeforeUpdate = JSON.parse(JSON.stringify(prompt)) as Entity;
        prompt.folderId.replace(`/${folder.name}`, '');
        prompt.id.replace(`/${folder.name}`, '');
        await dataInjector.updatePrompts([prompt]);
        await itemApiHelper.deleteEntity(promptBeforeUpdate);
      },
    );

    await dialSharedWithMeTest.step(
      'Verify only empty folder but not prompt is shared',
      async () => {
        const sharedPrompts =
          await additionalUserShareApiHelper.listSharedWithMePrompts();
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedPrompts,
          prompt,
          'hidden',
        );
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedPrompts,
          folder,
          'visible',
        );
      },
    );
  },
);
