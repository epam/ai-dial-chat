import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { EntityPlusAttachmentRequest } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

//TODO: add to env var when issue with Vertex adapter is fixed on review envs
// { entityId: ModelIds.GEMINI_PRO_VISION, "attachmentName": "sun.jpg", "response": "sun" }
const entityPlusAttachmentRequests = process.env
  .ENTITY_PLUS_ATTACHMENT_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ENTITY_PLUS_ATTACHMENT_FOR_API_TESTS,
    ) as EntityPlusAttachmentRequest[])
  : [];

for (const entity of entityPlusAttachmentRequests) {
  dialTest(
    `Generate response on request with attachment for entity: ${entity.entityId}`,
    async ({
      conversationData,
      chatApiHelper,
      fileApiHelper,
      apiAssertion,
    }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const imageUrl = await fileApiHelper.putFile(entity.attachmentName);
      const conversation =
        conversationData.prepareConversationWithAttachmentsInRequest(
          entity.entityId,
          entity.request,
          imageUrl,
        );
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.entityId, 200);
      await apiAssertion.assertResponseTextContent(
        response,
        entity.entityId,
        entity.response,
      );
    },
  );
}

dialTest(
  'Replay feature sends attachments',
  async ({
    conversationData,
    chatApiHelper,
    fileApiHelper,
    apiAssertion,
    setTestIds,
  }) => {
    dialTest.skip(
      process.env.E2E_HOST === undefined ||
        entityPlusAttachmentRequests.length === 0,
      skipReason,
    );
    setTestIds('EPMRTC-1803');
    const replayEntity = GeneratorUtil.randomArrayElement(
      entityPlusAttachmentRequests,
    );
    const imageUrl = await fileApiHelper.putFile(replayEntity.attachmentName);
    const conversation =
      conversationData.prepareConversationWithAttachmentsInRequest(
        replayEntity.entityId,
        replayEntity.request,
        imageUrl,
      );
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    const modelResponse = await chatApiHelper.postRequest(replayConversation);
    await apiAssertion.assertResponseCode(
      modelResponse,
      replayEntity.entityId,
      200,
    );
    await apiAssertion.assertResponseTextContent(
      modelResponse,
      replayEntity.entityId,
      replayEntity.response,
    );
  },
);
