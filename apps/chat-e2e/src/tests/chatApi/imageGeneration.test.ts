import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ModelIds } from '@/src/testData';

const modelsForImageGeneration = Array.of(
  ModelIds.STABLE_DIFFUSION,
  ModelIds.DALLE,
  ModelIds.IMAGE_GENERATION_005,
);

for (const modelToUse of modelsForImageGeneration) {
  dialTest(
    `Generate image for model: ${modelToUse}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation =
        conversationData.prepareModelConversationBasedOnRequests(modelToUse, [
          'draw smiling emoticon',
        ]);

      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.verifyResponseCode(response, modelToUse, 200);
      await apiAssertion.verifyResponseAttachment(response, modelToUse);
    },
  );
}

dialTest(
  'Replay feature receives attachments',
  async ({ conversationData, chatApiHelper, setTestIds, apiAssertion }) => {
    dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
    setTestIds('EPMRTC-1803');
    const conversation =
      conversationData.prepareModelConversationBasedOnRequests(ModelIds.DALLE, [
        'draw smiling emoticon',
      ]);
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    const response = await chatApiHelper.postRequest(replayConversation);
    await apiAssertion.verifyResponseCode(response, ModelIds.DALLE, 200);
    await apiAssertion.verifyResponseAttachment(response, ModelIds.DALLE);
  },
);
