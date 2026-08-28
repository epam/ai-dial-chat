import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import { OverlaySandboxUrls } from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

let modelWithAudioInput: DialAIEntityModel;
dialOverlayTest.beforeAll(async () => {
  modelWithAudioInput = GeneratorUtil.randomArrayElement(
    ModelsUtil.getLatestModels().filter((m) =>
      m.inputAttachmentTypes?.some((type) => type.startsWith('audio/')),
    ),
  );
});

dialOverlayTest(
  '[Overlay] enable VoiceInput flag',
  async ({
    overlayLocalStorageManager,
    overlayHomePage,
    overlayHeader,
    overlayConversations,
    overlaySendMessage,
    overlayBaseAssertion,
    overlayDataInjector,
    conversationData,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2326');
    let conversation: Conversation;

    await dialOverlayTest.step(
      'Prepare a conversation based on a model which supports audio recording',
      async () => {
        conversation =
          conversationData.prepareDefaultConversation(modelWithAudioInput);
        await overlayDataInjector.createConversations([conversation]);
        await overlayLocalStorageManager.setRecentModelsIdsAndUseLastModel(
          modelWithAudioInput,
        );
      },
    );

    await dialOverlayTest.step(
      'Open the sandbox with Feature.VoiceInput enabled, select the conversation and verify the microphone icon appears in the input',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enableVoiceInputUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayConversations.selectEntity(conversation.name);
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage.voiceRecordButton,
          'visible',
        );
      },
    );
  },
);
