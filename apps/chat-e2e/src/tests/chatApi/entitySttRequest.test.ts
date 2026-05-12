import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { Attachment, SttRequestEntity } from '@/src/testData';

const sttRequestModels = process.env.ENTITY_STT_REQUEST_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ENTITY_STT_REQUEST_FOR_API_TESTS,
    ) as SttRequestEntity[])
  : [];
const expectedTranscription = 'Robots are awesome';

for (const entity of sttRequestModels) {
  dialTest(
    `Generate STT transcription response for entity: ${entity.eId}`,
    async ({
      conversationData,
      chatApiHelper,
      fileApiHelper,
      apiAssertion,
    }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const audioUrl = await fileApiHelper.putFile(Attachment.sttAudioName);
      const conversation =
        conversationData.prepareConversationWithAttachmentsInRequest(
          entity.eId,
          undefined,
          undefined,
          audioUrl,
        );
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.eId, 200);
      await apiAssertion.assertResponseTextContent(
        response,
        entity.eId,
        entity.r ?? expectedTranscription,
      );
    },
  );
}
