import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { EntityPlusAddonsRequest } from '@/src/testData';

const entityPlusAddonsRequests = process.env.ENTITY_PLUS_ADDONS_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ENTITY_PLUS_ADDONS_FOR_API_TESTS,
    ) as EntityPlusAddonsRequest[])
  : [];

for (const entity of entityPlusAddonsRequests) {
  dialTest(
    `Generate response for entity: ${entity.entityId} plus addons: ${entity.addonIds}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation = conversationData.prepareAddonsConversation(
        entity.entityId,
        entity.addonIds,
        entity.request,
      );
      if (entity.systemPrompt) {
        conversation.prompt = entity.systemPrompt;
      }
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
