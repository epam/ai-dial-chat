import { InputAttachmentsAssertions } from '@/src/assertions/InputAttachmentsAssertions';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { FileSelectors } from '@/src/ui/selectors';
import { FileModalSection, InputAttachments } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest.only(
  'Use own prompt for new conversation\n' +
    'Use own prompt for chat with history\n' +
    'Use prompt for chat with attached file\n' +
    'Use prompt for chats in Compare mode\n' +
    "prompt body is applied on 'Use' click into the Input message, in the end of existing content",
  async ({
    dialHomePage,
    header,
    prompts,
    promptDropdownMenu,
    sendMessageAssertion,
    setTestIds,
    promptData,
    dataInjector,
    sendMessage,
    chat,
    localStorageManager,
    attachFilesModal,
    attachmentDropdownMenu,
    uploadFromDeviceModal,
    manageAttachmentsAssertion,
    fileApiHelper,
    sendMessageInputAttachmentsAssertions,
    chatBar,
    compare,
    editMessageInputAttachments,
    sendMessageInputAttachments,
  }) => {
    setTestIds(
      'EPMRTC-5486',
      'EPMRTC-5487',
      'EPMRTC-5490',
      'EPMRTC-5512',
      'EPMRTC-5497',
    );
    // Select a model that allows file attachments
    const modelWithAttachment = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    );
    await localStorageManager.setRecentModelsIds(modelWithAttachment);

    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const initialMessage = GeneratorUtil.randomString(10);
    const message = GeneratorUtil.randomString(10);
    await localStorageManager.setShowSideBarPanels();
    await fileApiHelper.putFile(Attachment.sunImageName);

    await dialTest.step('Open the Dial', async () => {
      await dialHomePage.openHomePage({
        iconsToBeLoaded: [modelWithAttachment.iconUrl],
      });
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Use prompt from context menu in the empty message text area',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
          triggeredHttpMethod: 'GET',
        });
        await sendMessageAssertion.assertMessageValue(` ${prompt.content}`);
      },
    );

    await dialTest.step(
      'Type initial message and use the prompt from context menu',
      async () => {
        await sendMessage.messageInput.fillInInput(initialMessage);
        await sendMessageAssertion.assertMessageValue(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
      },
    );

    await dialTest.step(
      'Type message, get response, type data, and use prompt from context menu',
      async () => {
        await sendMessage.clearMessageInput();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(message);
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
      },
    );

    await dialTest.step(
      'Attach file, type message, and use prompt from context menu',
      async () => {
        await sendMessage.clearMessageInput();
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await attachFilesModal.checkAttachedFile(
          Attachment.sunImageName,
          FileModalSection.AllFiles,
        );
        await attachFilesModal.attachFiles();
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
        await sendMessageInputAttachmentsAssertions.assertAttachedFileState(
          Attachment.sunImageName,
          'visible',
        );
        await sendMessageInputAttachments
          .removeInputAttachmentIcon(Attachment.sunImageName)
          .click();
      },
    );

    await dialTest.step(
      'Enter compare mode and use prompt from context menu',
      async () => {
        await sendMessage.clearMessageInput();
        await chatBar.openCompareMode();
        await compare.waitForState({ state: 'visible' });
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(` ${prompt.content}`);
      },
    );
  },
);

dialTest(
  'Use prompt with parameters for chat',
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    sendMessageAssertion,
    setTestIds,
    promptData,
    dataInjector,
    sendMessage,
    conversations,
    conversationData,
    variableModalDialog,
    chat,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-5493');
    const promptParam = 'testParam';
    const promptContent = `This is a prompt with a parameter: {{${promptParam}}}`;
    const prompt = promptData.preparePrompt(promptContent);
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createPrompts([prompt]);
    await dataInjector.createConversations([conversation]);
    const paramValue = GeneratorUtil.randomString(10);
    const initialMessage = GeneratorUtil.randomString(10);
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open Dial', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step(
      'Use prompt from context menu and input parameter value',
      async () => {
        await conversations.selectConversation(conversation.name);
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
          triggeredHttpMethod: 'GET',
        });
        await variableModalDialog.waitForState();
        await variableModalDialog.setVariableValue(promptParam, paramValue);
        await variableModalDialog.submitButton.click();
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${promptContent.replace(
            `{{${promptParam}}}`,
            paramValue,
          )}`,
        );
      },
    );
  },
);

dialTest(
  'Use prompt option is not available for Chat in Replay mode\n' +
    'Use prompt is available for chat in Replay mode when response generation was stopped\n' +
    'Use prompt option is not available for Chat in Playback mode',
  async ({
    dialHomePage,
    conversations,
    chatAssertion,
    prompts,
    promptDropdownMenuAssertion,
    setTestIds,
    conversationData,
    dataInjector,
    promptData,
    sendMessageAssertion,
    chat,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-5494', 'EPMRTC-5504', 'EPMRTC-5495');
    const conversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversation2 = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    conversationData.resetData();
    const partiallyReplayedConversation =
      conversationData.preparePartiallyReplayedConversation(conversation2);
    conversationData.resetData();
    const playbackConversation =
      conversationData.prepareDefaultPlaybackConversation(conversation);
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createConversations([
      replayConversation,
      partiallyReplayedConversation,
      playbackConversation,
    ]);
    await dataInjector.createPrompts([prompt]);
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step(
      'Select replay chat and verify "Start replay" screen',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(replayConversation.name);
        await chatAssertion.assertReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Verify "Use" option is not available for the prompt',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Select partially replayed chat and verify "Continue replay" screen',
      async () => {
        await conversations.selectConversation(
          partiallyReplayedConversation.name,
        );
        await sendMessageAssertion.assertContinueReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Hover over prompt and verify "Use" option is enabled',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Select playback chat and verify "Use" option is disabled',
      async () => {
        await conversations.selectConversation(playbackConversation.name);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );

    await dialTest.step(
      'Click "Continue" and verify "Use" option is still disabled',
      async () => {
        await chat.playNextChatMessage(false);
        await chat.playNextChatMessage(false);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenuAssertion.assertMenuOptionActionabilityState(
          MenuOptions.use,
          'disabled',
        );
      },
    );
  },
);
