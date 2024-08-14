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
  { modelId: ModelIds.GPT_3_5_TURBO, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_3_5_TURBO_16K, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_3_5_TURBO_0125, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_3_5_TURBO_1106, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_1106_PREVIEW, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_0125_PREVIEW, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_TURBO_2024_04_29, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_TURBO, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_32K_0314, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_32K_0613, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_O_2024_05_13, isSysPromptAllowed: true },
  { modelId: ModelIds.GPT_4_O_MINI_2024_07_18, isSysPromptAllowed: true },
  { modelId: ModelIds.BISON_001, isSysPromptAllowed: true },
  { modelId: ModelIds.BISON_32k_002, isSysPromptAllowed: true },
  { modelId: ModelIds.CODE_BISON_001, isSysPromptAllowed: false },
  { modelId: ModelIds.CODE_BISON_32K_002, isSysPromptAllowed: false },
  { modelId: ModelIds.AWS_TITAN, isSysPromptAllowed: true },
  { modelId: ModelIds.AI21_GRANDE, isSysPromptAllowed: true },
  { modelId: ModelIds.AI21_JUMBO, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V2, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V21, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V3_SONNET, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V3_HAIKU, isSysPromptAllowed: true },
  //TODO: enable when model is available for all configured endpoints
  // { modelId: ModelIds.ANTHROPIC_CLAUDE_V3_OPUS, isSysPromptAllowed: true },
  {
    modelId: ModelIds.ANTHROPIC_CLAUDE_INSTANT_V1,
    isSysPromptAllowed: true,
  },
  { modelId: ModelIds.GEMINI_PRO, isSysPromptAllowed: true },
  { modelId: ModelIds.LLAMA3_8B_INSTRUCT_V1, isSysPromptAllowed: true },
  { modelId: ModelIds.LLAMA3_70B_INSTRUCT_V1, isSysPromptAllowed: true },
  //TODO: enable when API keys updated
  // { modelId: ModelIds.DATABRICKS_DBRX_INSTRUCT, isSysPromptAllowed: true },
  // {
  //   modelId: ModelIds.DATABRICKS_MIXTRAL_8X7B_INSTRUCT,
  //   isSysPromptAllowed: true,
  // },
  // { modelId: ModelIds.DATABRICKS_LLAMA_2_70B_CHAT, isSysPromptAllowed: true },
  { modelId: ModelIds.MISTRAL_LARGE, isSysPromptAllowed: true },
  { modelId: ModelIds.GEMINI_PRO_1_5, isSysPromptAllowed: true },
  { modelId: ModelIds.GEMINI_FLASH_1_5, isSysPromptAllowed: true },
);

for (const modelToUse of modelsForArithmeticRequest) {
  dialTest(
    `Generate arithmetic response for model: ${modelToUse.modelId}`,
    async ({ conversationData, chatApiHelper }) => {
      test.skip(process.env.E2E_HOST === undefined, skipReason);
      const conversation = conversationData.prepareModelConversation(
        0,
        modelToUse.isSysPromptAllowed
          ? 'Evaluate the given arithmetic expression and return only the numerical result. Do not include any explanations, units, or additional text. Provide the answer in its simplest form, using scientific notation for very large or small numbers when appropriate. Support basic arithmetic operations (+, -, *, /), exponents (^), parentheses, and common mathematical functions (sqrt, sin, cos, tan, log, ln). Round the result to 6 decimal places if necessary'
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
