import test, { skipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, ModelIds } from '@/src/testData';
import { expect } from '@playwright/test';

const modelsForArithmeticRequest: {
  modelId: string;
  isSysPromptAllowed: boolean;
}[] = Array.of(
  { modelId: ModelIds.GPT_3_5_TURBO_0301, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_3_5_TURBO_0613, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_3_5_TURBO_1106, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_3_5_TURBO_16K, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_0314, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_0613, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_1106_PREVIEW, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_0125_PREVIEW, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_32K_0314, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_32K_0613, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_32K, isSysPromptAllowed: true },
  { modelId: ModelIds.BISON_001, isSysPromptAllowed: true },
  { modelId: ModelIds.BISON_32k_002, isSysPromptAllowed: true },
  { modelId: ModelIds.CODE_BISON_001, isSysPromptAllowed: false },
  { modelId: ModelIds.CODE_BISON_32K_002, isSysPromptAllowed: false },
  { modelId: ModelIds.AWS_TITAN, isSysPromptAllowed: true },
  { modelId: ModelIds.AI21_GRANDE, isSysPromptAllowed: true },
  { modelId: ModelIds.AI21_JUMBO, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V2, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V21, isSysPromptAllowed: true },
  {
    modelId: ModelIds.ANTHROPIC_CLAUDE_INSTANT_V1,
    isSysPromptAllowed: true,
  },
  { modelId: ModelIds.GEMINI_PRO, isSysPromptAllowed: true },
);

for (const modelToUse of modelsForArithmeticRequest) {
  dialTest(
    `Generate arithmetic response for model: ${modelToUse.modelId}`,
    async ({ conversationData, chatApiHelper }) => {
      test.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation = conversationData.prepareModelConversation(
        0,
        modelToUse.isSysPromptAllowed
          ? 'Answer arithmetic question. The answer should be number, do not use natural language'
          : '',
        [],
        modelToUse.modelId,
      );
      conversation.messages[0].content = '1+2=';

      const response = await chatApiHelper.postRequest(conversation);
      const status = response.status();
      expect
        .soft(
          status,
          `${ExpectedMessages.responseCodeIsValid}${modelToUse.modelId}`,
        )
        .toBe(200);

      const respBody = await response.text();
      const results = respBody.match(ExpectedConstants.responseContentPattern);
      const result = results?.join('');
      expect
        .soft(
          result,
          `${ExpectedMessages.responseTextIsValid}${modelToUse.modelId}`,
        )
        .toMatch(/\s?3\.?/);
    },
  );
}
