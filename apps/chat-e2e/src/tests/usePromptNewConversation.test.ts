import { InputAttachmentsAssertions } from '@/src/assertions/InputAttachmentsAssertions';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { FileModalSection } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest(
  'Use own prompt for new conversation\n' +
    'Use own prompt for chat with history\n' +
    'Use prompt for chat with attached file',
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
  }) => {
    setTestIds('EPMRTC-5486', 'EPMRTC-5487', 'EPMRTC-5490');
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

    await dialTest.step('Type initial message', async () => {
      await sendMessage.messageInput.fillInInput(initialMessage);
      await sendMessageAssertion.assertMessageValue(initialMessage);
    });

    await dialTest.step('Use prompt from context menu', async () => {
      await prompts.openEntityDropdownMenu(prompt.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
        triggeredHttpMethod: 'GET',
      });
      await sendMessageAssertion.assertMessageValue(
        `${initialMessage} ${prompt.content}`,
      );
    });

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
        );
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
  'Use prompt option is not available for Chat in Replay mode',
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
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-5494');
    const conversation = conversationData.prepareDefaultConversation();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createConversations([conversation, replayConversation]);
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
  },
);
