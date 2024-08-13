import { ChatBody } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { expect } from '@playwright/test';
import { APIResponse } from 'playwright-core';

export class ApiAssertion {
  public async verifyResponseCode(
    response: APIResponse,
    modelId: string,
    expectedStatus: number,
  ) {
    const status = response.status();
    expect
      .soft(status, `${ExpectedMessages.responseCodeIsValid}${modelId}`)
      .toBe(expectedStatus);
  }

  public async verifyResponseTextContent(
    response: APIResponse,
    modelId: string,
    expectedContent: string,
  ) {
    const respBody = await response.text();
    const results = respBody.match(ExpectedConstants.responseContentPattern);
    const result = results?.join('');
    expect
      .soft(result, `${ExpectedMessages.responseTextIsValid}${modelId}`)
      .toMatch(new RegExp(`.*${expectedContent}.*`, 'i'));
  }

  public async verifyResponseAttachment(
    response: APIResponse,
    modelId: string,
  ) {
    const respBody = await response.text();
    const result = respBody.match(ExpectedConstants.responseFileUrlPattern);
    const imageUrl = result ? result[0] : undefined;
    expect
      .soft(
        imageUrl,
        `${ExpectedMessages.imageUrlReturnedInResponse}${modelId}`,
      )
      .toMatch(ExpectedConstants.responseFileUrlContentPattern(modelId));
  }

  public async verifyRequestModelId(
    request: ChatBody,
    expectedModel: DialAIEntityModel,
  ) {
    expect
      .soft(request.modelId, ExpectedMessages.chatRequestModelIsValid)
      .toBe(expectedModel.id);
  }

  public async verifyRequestTemperature(
    request: ChatBody,
    expectedTemperature: number,
  ) {
    expect
      .soft(request.temperature, ExpectedMessages.chatRequestTemperatureIsValid)
      .toBe(expectedTemperature);
  }

  public async verifyRequestPrompt(request: ChatBody, expectedPrompt: string) {
    expect
      .soft(request.prompt, ExpectedMessages.chatRequestPromptIsValid)
      .toBe(expectedPrompt);
  }

  public async verifyRequestAddons(
    request: ChatBody,
    expectedAddons: string[],
  ) {
    expect
      .soft(request.selectedAddons, ExpectedMessages.chatRequestAddonsAreValid)
      .toEqual(expectedAddons);
  }

  public async verifyRequestAttachments(
    request: ChatBody,
    ...expectedAttachmentUrls: string[]
  ) {
    for (const attachmentUrl of expectedAttachmentUrls) {
      const requestAttachmentUrl = request.messages.filter(
        (m) =>
          m.role === 'user' &&
          m.custom_content?.attachments?.find((a) => a.url === attachmentUrl),
      );
      expect
        .soft(
          requestAttachmentUrl,
          ExpectedMessages.chatRequestAttachmentIsValid,
        )
        .toBeDefined();
    }
  }
}
