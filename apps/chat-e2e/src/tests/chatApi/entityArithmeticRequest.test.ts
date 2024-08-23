import { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ArithmeticRequestEntity } from '@/src/testData';

const arithmeticRequestModels = process.env
  .ENTITY_ARITHMETIC_REQUEST_FOR_API_TESTS
  ? (JSON.parse(
      process.env.ENTITY_ARITHMETIC_REQUEST_FOR_API_TESTS,
    ) as ArithmeticRequestEntity[])
  : [];
const systemPrompt =
  'Evaluate the given arithmetic expression and return only the numerical result. Do not include any explanations, units, or additional text. Provide the answer in its simplest form, using scientific notation for very large or small numbers when appropriate. Support basic arithmetic operations (+, -, *, /), exponents (^), parentheses, and common mathematical functions (sqrt, sin, cos, tan, log, ln). Round the result to 6 decimal places if necessary';
const request = '1+2=';

for (const entity of arithmeticRequestModels) {
  dialTest(
    `Generate arithmetic response for entity: ${entity.entityId}`,
    async ({ conversationData, chatApiHelper, apiAssertion }) => {
      dialTest.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation = conversationData.prepareModelConversation(
        0,
        entity.isSysPromptAllowed ? systemPrompt : '',
        [],
        entity.entityId,
      );
      conversation.messages[0].content = request;
      const response = await chatApiHelper.postRequest(conversation);
      await apiAssertion.assertResponseCode(response, entity.entityId, 200);
      await apiAssertion.assertResponseTextContent(
        response,
        entity.entityId,
        '3',
      );
    },
  );
}
