import { ChatBody } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Prompt } from '@/chat/types/prompt';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { Message } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';
import { APIResponse } from 'playwright-core';

export class ApiAssertion {
  public async assertResponseCode(
    response: APIResponse,
    modelId: string,
    expectedStatus: number,
  ) {
    const status = response.status();
    expect
      .soft(status, `${ExpectedMessages.responseCodeIsValid}${modelId}`)
      .toBe(expectedStatus);
  }

  public async assertResponseTextContent(
    response: APIResponse,
    modelId: string,
    expectedContent?: string,
  ) {
    const respBody = await response.text();
    const results = respBody.match(ExpectedConstants.responseContentPattern);
    const result = results?.join('');
    expectedContent
      ? expect
          .soft(result, `${ExpectedMessages.responseTextIsValid}${modelId}`)
          .toMatch(new RegExp(`.*${expectedContent}.*`, 'i'))
      : expect
          .soft(
            result!.length > 0,
            `${ExpectedMessages.responseTextIsValid}${modelId}`,
          )
          .toBeTruthy();
  }

  public async assertResponseAttachment(
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

  public async assertRequestModelId(
    request: ChatBody,
    expectedModel: DialAIEntityModel,
  ) {
    expect
      .soft(request.model?.id, ExpectedMessages.chatRequestModelIsValid)
      .toBe(expectedModel.id);
  }

  public async assertRequestTemperature(
    request: ChatBody,
    expectedTemperature: number,
  ) {
    expect
      .soft(request.temperature, ExpectedMessages.chatRequestTemperatureIsValid)
      .toBe(expectedTemperature);
  }

  public async assertRequestPrompt(
    request: ChatBody,
    expectedPrompt: string | undefined,
  ) {
    if (request.prompt === undefined) {
      expect
        .soft(request.prompt, ExpectedMessages.chatRequestPromptIsValid)
        .toBeUndefined();
    } else {
      expect
        .soft(request.prompt, ExpectedMessages.chatRequestPromptIsValid)
        .toBe(expectedPrompt);
    }
  }

  public async assertRequestAddons(
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

  public async assertRequestMessage(
    requestMessage: Message,
    expectedMessage: string,
  ) {
    expect
      .soft(requestMessage.content, ExpectedMessages.chatRequestMessageIsValid)
      .toBe(expectedMessage);
  }

  public async assertRequestPromptName(request: Prompt, expectedValue: string) {
    expect
      .soft(request.name, ExpectedMessages.promptRequestNameIsValid)
      .toBe(expectedValue);
  }

  public async assertRequestPromptDescription(
    request: Prompt,
    expectedValue: string,
  ) {
    expect
      .soft(
        request.description,
        ExpectedMessages.promptRequestDescriptionIsValid,
      )
      .toBe(expectedValue);
  }

  public async assertRequestPromptContent(
    request: Prompt,
    expectedValue: string,
  ) {
    expect
      .soft(request.content, ExpectedMessages.promptRequestContentIsValid)
      .toBe(expectedValue);
  }
}
