import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { get_encoding } from '@dqbd/tiktoken';

dialTest(
  'Prompt exceeded the limit is not copied into input message field.\n' +
    'Amount of tokens in the message is calculated',
  async ({
    dialHomePage,
    confirmationDialog,
    confirmationDialogAssertion,
    setTestIds,
    conversationData,
    sendMessage,
    sendMessageAssertion,
    localStorageManager,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-1200', 'EPMRTC-3006');
    let conversation: Conversation;
    const allModels = ModelsUtil.getModels();
    const randomModel = GeneratorUtil.randomArrayElement(
      allModels.filter(
        (model) =>
          model.limits?.maxRequestTokens !== undefined &&
          !model.inputAttachmentTypes,
      ),
    );
    const requestTokensLimit = randomModel.limits?.maxRequestTokens;
    const exceededTokensLengthRequest = [
      ...GeneratorUtil.randomString(requestTokensLimit!),
    ].join(' ');
    const firstRequestLine = 'hi there' + '\n';
    let encoding;
    if (randomModel.tokenizer?.encoding) {
      encoding = get_encoding(randomModel.tokenizer.encoding);
    }
    const firstRequestLineTokens =
      encoding?.encode(firstRequestLine).length ??
      new Blob([firstRequestLine]).size;

    await dialTest.step(
      'Prepare empty conversation with random model',
      async () => {
        conversation = conversationData.prepareEmptyConversation(randomModel);
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Set request with exceeded tokens count and verify warning popup is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessage.fillRequestData(exceededTokensLengthRequest);
        await confirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.promptLimitExceededTitle,
        );
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.promptLimitExceededMessage(
            requestTokensLimit!,
            0,
            requestTokensLimit!,
          ),
        );
        await confirmationDialog.confirm();
      },
    );

    await dialTest.step(
      'Set short request and request with exceeded tokens count on next line and verify warning popup is displayed, only first request is preserved in the input',
      async () => {
        await sendMessage.fillRequestData(firstRequestLine);
        await sendMessage.fillRequestData(exceededTokensLengthRequest);
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.promptLimitExceededMessage(
            requestTokensLimit!,
            firstRequestLineTokens,
            requestTokensLimit! - firstRequestLineTokens,
          ),
        );
        await confirmationDialog.confirm();
        await sendMessageAssertion.assertMessageValue(firstRequestLine);
      },
    );
  },
);
