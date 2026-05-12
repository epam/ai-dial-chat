import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { EntityPlusAttachmentRequest } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

const entityPlusAttachmentRequests = process.env
  .ENTITY_PLUS_ATTACHMENT_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ENTITY_PLUS_ATTACHMENT_FOR_API_TESTS,
    ) as EntityPlusAttachmentRequest[])
  : [];

for (const entity of entityPlusAttachmentRequests) {
  dialTest(
    `Generate response on request with attachment for entity: ${entity.eId}`,
    async ({
      conversationData,
      chatApiHelper,
      fileApiHelper,
      apiAssertion,
    }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const imageUrl = await fileApiHelper.putFile(entity.aN);
      const conversation =
        conversationData.prepareConversationWithAttachmentsInRequest(
          entity.eId,
          entity.req,
          undefined,
          imageUrl,
        );
      if (entity.sP) {
        conversation.prompt = entity.sP;
      }
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.eId, 200);
      await apiAssertion.assertResponseTextContent(
        response,
        entity.eId,
        entity.r,
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
    const imageUrl = await fileApiHelper.putFile(replayEntity.aN);
    const conversation =
      conversationData.prepareConversationWithAttachmentsInRequest(
        replayEntity.eId,
        replayEntity.req,
        undefined,
        imageUrl,
      );
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    const modelResponse = await chatApiHelper.postRequest(replayConversation);
    await apiAssertion.assertResponseCode(
      modelResponse,
      replayEntity.eId,
      200,
    );
    await apiAssertion.assertResponseTextContent(
      modelResponse,
      replayEntity.eId,
      replayEntity.r,
    );
  },
);
