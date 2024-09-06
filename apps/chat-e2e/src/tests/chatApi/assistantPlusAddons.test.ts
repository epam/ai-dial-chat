import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { AssistantPlusAddonsRequest } from '@/src/testData';

const entityPlusAddonsRequests = process.env.ASSISTANT_PLUS_ADDONS_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ASSISTANT_PLUS_ADDONS_FOR_API_TESTS,
    ) as AssistantPlusAddonsRequest[])
  : [];

for (const entity of entityPlusAddonsRequests) {
  dialTest(
    `Generate response for assistant: ${entity.assistantId} with addons: ${entity.addonIds}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation = conversationData.prepareAssistantConversation(
        entity.assistantId,
        entity.addonIds,
        entity.assistantModelId,
        entity.request,
      );
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.assistantId, 200);
      await apiAssertion.assertResponseTextContent(
        response,
        entity.assistantId,
        entity.response,
      );
    },
  );
}
