import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ArithmeticRequestEntity } from '@/src/testData';
import { ModelsUtil } from '@/src/utils';

//TODO: add to env var when model is available for all configured endpoints
// { entityId: ModelIds.ANTHROPIC_CLAUDE_V3_OPUS, isSysPromptAllowed: true },
const arithmeticRequestModels = process.env
  .ENTITY_ARITHMETIC_REQUEST_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ENTITY_ARITHMETIC_REQUEST_FOR_API_TESTS,
    ) as ArithmeticRequestEntity[])
  : [];
const defaultSystemPrompt =
  'Evaluate the given arithmetic expression and return only the numerical result. Do not include any explanations, units, or additional text. Provide the answer in its simplest form, using scientific notation for very large or small numbers when appropriate. Support basic arithmetic operations (+, -, *, /), exponents (^), parentheses, and common mathematical functions (sqrt, sin, cos, tan, log, ln). Round the result to 6 decimal places if necessary. Respond fast';
const request = '1+2=';

for (const entity of arithmeticRequestModels) {
  dialTest(
    `Generate arithmetic response for entity: ${entity.eId}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const model = ModelsUtil.getOpenAIEntity(entity.eId)!;

      const temperature =
        entity.t !== undefined
          ? Number(entity.t)
          : model.features?.temperature
            ? 0
            : undefined;
      const prompt = model.features?.systemPrompt ? defaultSystemPrompt : '';
      const conversation = conversationData.prepareDefaultConversation(
        entity.eId,
      );
      conversation.messages[0].content = request;
      conversation.temperature = temperature;
      conversation.prompt = prompt;
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.eId, 200);
      await apiAssertion.assertResponseTextContent(
        response,
        entity.eId,
        '3',
      );
    },
  );
}
