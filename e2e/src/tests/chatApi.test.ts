import { BucketUtil } from '@/e2e/src/utils/bucketUtil';

import test from '@/e2e/src/core/fixtures';
import { ModelIds } from '@/e2e/src/testData';
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
  { modelId: ModelIds.GPT_4_TURBO_1106, isSysPromptAllowed: true },
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
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V1, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V2, isSysPromptAllowed: true },
  { modelId: ModelIds.ANTHROPIC_CLAUDE_V21, isSysPromptAllowed: true },
  {
    modelId: ModelIds.ANTHROPIC_CLAUDE_INSTANT_V1,
    isSysPromptAllowed: true,
  },
  { modelId: ModelIds.GEMINI_PRO, isSysPromptAllowed: true },
);

const modelsForImageRequest = Array.of(
  ModelIds.STABLE_DIFFUSION,
  ModelIds.DALLE,
  ModelIds.IMAGE_GENERATION_005,
);

for (const modelToUse of modelsForArithmeticRequest) {
  test(`Generate arithmetic response for model: ${modelToUse.modelId}`, async ({
    conversationData,
    chatApiHelper,
  }) => {
    const conversation = conversationData.prepareModelConversation(
      0,
      modelToUse.isSysPromptAllowed
        ? 'Answer arithmetic question. The answer should be number, do not use natural language'
        : '',
      [],
      modelToUse.modelId,
    );
    conversation.messages[0].content = '1+2=';

    const response = await chatApiHelper.postModel(conversation);
    const status = response.status();
    expect
      .soft(status, `Response code is valid for model: ${modelToUse.modelId}`)
      .toBe(200);

    const respBody = await response.text();
    const results = respBody.match(/(?<=\{"content":")[^"^\\$]+/g);
    const result = results?.join('');
    expect
      .soft(result, `Response text is valid for model: ${modelToUse.modelId}`)
      .toMatch(/\s?3\.?/);
  });
}

for (const modelToUse of modelsForImageRequest) {
  test(`Generate image for model: ${modelToUse}`, async ({
    conversationData,
    chatApiHelper,
  }) => {
    const conversation =
      conversationData.prepareModelConversationBasedOnRequests(modelToUse, [
        'draw smiling emoticon',
      ]);

    const response = await chatApiHelper.postModel(conversation);
    const status = response.status();
    expect
      .soft(status, `Response code is valid for model: ${modelToUse}`)
      .toBe(200);

    const respBody = await response.text();
    const result = respBody.match(/(?<="url":")[^"$]+/g);
    expect
      .soft(
        result ? result[0] : undefined,
        `Image url returned in the response for model: ${modelToUse}`,
      )
      .toMatch(
        new RegExp(
          BucketUtil.getBucket() +
            '/appdata/' +
            modelToUse +
            '/images/.*\\.png',
          'g',
        ),
      );
  });
}
