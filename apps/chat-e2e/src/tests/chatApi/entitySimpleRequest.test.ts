import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { EntitySimpleRequest } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

const entitySimpleRequests = process.env.ENTITY_SIMPLE_REQUEST_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ENTITY_SIMPLE_REQUEST_FOR_API_TESTS,
    ) as EntitySimpleRequest[])
  : [];

for (const entity of entitySimpleRequests) {
  dialTest(
    `Generate simple response for entity: ${entity.entityId}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation =
        conversationData.prepareModelConversationBasedOnRequests(
          [entity.request],
          entity.entityId,
        );
      if (entity.systemPrompt) {
        conversation.prompt = entity.systemPrompt;
      }
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.entityId, 200);
      entity.isAttachmentResponse
        ? await apiAssertion.assertResponseAttachment(response, entity.entityId)
        : await apiAssertion.assertResponseTextContent(
            response,
            entity.entityId,
            entity.response,
          );
    },
  );
}

dialTest(
  'Replay feature receives attachments',
  async ({ conversationData, chatApiHelper, setTestIds, apiAssertion }) => {
    dialTest.skip(
      process.env.E2E_HOST === undefined || entitySimpleRequests.length === 0,
      skipReason,
    );
    setTestIds('EPMRTC-1803');
    const replayEntity = GeneratorUtil.randomArrayElement(
      entitySimpleRequests.filter((e) => e.isAttachmentResponse),
    );
    const conversation =
      conversationData.prepareModelConversationBasedOnRequests(
        [replayEntity.request],
        replayEntity.entityId,
      );
    conversationData.resetData();
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    const response = await chatApiHelper.postRequest(replayConversation);
    await apiAssertion.assertResponseCode(response, replayEntity.entityId, 200);
    await apiAssertion.assertResponseAttachment(
      response,
      replayEntity.entityId,
    );
  },
);
