import test from '@/e2e/src/core/fixtures';
import {
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  ModelIds,
} from '@/e2e/src/testData';
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

const modelsForImageGeneration = Array.of(
  ModelIds.STABLE_DIFFUSION,
  ModelIds.DALLE,
  ModelIds.IMAGE_GENERATION_005,
);

const modelsForRequestWithAttachment: {
  modelId: string;
  isTextRequestRequired: boolean;
}[] = Array.of(
  { modelId: ModelIds.GPT_4_VISION_PREVIEW, isTextRequestRequired: false },
  { modelId: ModelIds.GEMINI_PRO_VISION, isTextRequestRequired: true },
);

let imageUrl: string;
test.beforeAll(async ({ fileApiHelper }) => {
  imageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
});

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
  });
}

for (const modelToUse of modelsForImageGeneration) {
  test(`Generate image for model: ${modelToUse}`, async ({
    conversationData,
    chatApiHelper,
  }) => {
    const conversation =
      conversationData.prepareModelConversationBasedOnRequests(modelToUse, [
        'draw smiling emoticon',
      ]);

    const response = await chatApiHelper.postRequest(conversation);
    const status = response.status();
    expect
      .soft(status, `${ExpectedMessages.responseCodeIsValid}${modelToUse}`)
      .toBe(200);

    const respBody = await response.text();
    const result = respBody.match(ExpectedConstants.responseFileUrlPattern);
    expect
      .soft(
        result ? result[0] : undefined,
        `${ExpectedMessages.imageUrlReturnedInResponse}${modelToUse}`,
      )
      .toMatch(ExpectedConstants.responseFileUrlContentPattern(modelToUse));
  });
}

for (const modelToUse of modelsForRequestWithAttachment) {
  test.only(`Generate response on request with attachment for model: ${modelToUse.modelId}`, async ({
    conversationData,
    chatApiHelper,
  }) => {
    const conversation = conversationData.prepareConversationWithAttachment(
      imageUrl,
      modelToUse.modelId,
      modelToUse.isTextRequestRequired,
    );
    const modelResponse = await chatApiHelper.postRequest(conversation);
    const status = modelResponse.status();
    expect
      .soft(
        status,
        `${ExpectedMessages.responseCodeIsValid}${modelToUse.modelId}`,
      )
      .toBe(200);

    const respBody = await modelResponse.text();
    const results = respBody.match(ExpectedConstants.responseContentPattern);
    const result = results?.join('');
    expect
      .soft(
        result,
        `${ExpectedMessages.responseTextIsValid}${modelToUse.modelId}`,
      )
      .toMatch(new RegExp('.*sun.*', 'i'));
  });
}

test.afterAll(async ({ fileApiHelper }) => {
  await fileApiHelper.deleteFile(Attachment.sunImageName);
});
