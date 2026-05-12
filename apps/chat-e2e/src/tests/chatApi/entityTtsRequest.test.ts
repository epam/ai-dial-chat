import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { Entity } from '@/src/testData';

const ttsRequestModels = process.env.ENTITY_TTS_REQUEST_FOR_API_TESTS
  ? (JSON.parse(process.env.ENTITY_TTS_REQUEST_FOR_API_TESTS) as Entity[])
  : [];
const request =
  'EPAM DIAL is an enterprise AI platform that enables secure deployment and management of large language models.';

for (const entity of ttsRequestModels) {
  dialTest(
    `Generate TTS audio response for entity: ${entity.entityId}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation =
        conversationData.prepareModelConversationBasedOnRequests(
          [request],
          entity.entityId,
        );
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.entityId, 200);
      await apiAssertion.assertResponseAudioAttachment(
        response,
        entity.entityId,
      );
    },
  );
}
