import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { Attachment, ModelIds } from '@/src/testData';

const modelsForRequestWithAttachment: {
  modelId: string;
  isTextRequestRequired: boolean;
}[] = Array.of(
  { modelId: ModelIds.GPT_4_VISION_PREVIEW, isTextRequestRequired: false },
  { modelId: ModelIds.GEMINI_PRO_VISION, isTextRequestRequired: true },
);

const expectedContent = 'sun';

let imageUrl: string;
dialTest.beforeEach(async ({ fileApiHelper }) => {
  imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
});

for (const modelToUse of modelsForRequestWithAttachment) {
  dialTest(
    `Generate response on request with attachment for model: ${modelToUse.modelId}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation =
        conversationData.prepareConversationWithAttachmentsInRequest(
          modelToUse.modelId,
          modelToUse.isTextRequestRequired,
          imageUrl,
        );
      const modelResponse = await chatApiHelper.postRequest(conversation);
      await apiAssertion.verifyResponseCode(
        modelResponse,
        modelToUse.modelId,
        200,
      );
      await apiAssertion.verifyResponseTextContent(
        modelResponse,
        modelToUse.modelId,
        expectedContent,
      );
    },
  );
}

dialTest(
  'Replay feature sends attachments',
  async ({ conversationData, chatApiHelper, apiAssertion, setTestIds }) => {
    dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
    setTestIds('EPMRTC-1803');
    const modelId = ModelIds.GPT_4_VISION_PREVIEW;
    const conversation =
      conversationData.prepareConversationWithAttachmentsInRequest(
        modelId,
        false,
        imageUrl,
      );
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    const modelResponse = await chatApiHelper.postRequest(replayConversation);
    await apiAssertion.verifyResponseCode(modelResponse, modelId, 200);
    await apiAssertion.verifyResponseTextContent(
      modelResponse,
      modelId,
      expectedContent,
    );
  },
);
