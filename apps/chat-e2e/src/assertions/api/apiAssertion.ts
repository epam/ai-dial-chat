import { ChatBody, Conversation } from '@/chat/types/chat';
import { BackendEntity, MoveModel } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import { BaseAssertion } from '@/src/assertions';
import { ExpectedConstants, ExpectedMessages } from '@/src/testData';
import { ItemUtil } from '@/src/utils';
import {
  ConversationEntityModel,
  ConversationResponseFormat,
  Message,
} from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';
import { APIResponse } from 'playwright-core';

export class ApiAssertion extends BaseAssertion {
  public async assertResponseCode(
    response: APIResponse,
    entityId: string | undefined,
    expectedStatus: number,
  ) {
    const status = response.status();
    const body = await response.text();
    const bodySuffix = body ? `. Body: ${body}` : '';
    this.assertValue(
      status,
      expectedStatus,
      `${ExpectedMessages.responseCodeIsValid}${entityId !== undefined ? entityId : ''}${bodySuffix}`,
    );
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
      : this.assertBooleanCondition(
          result!.length > 0,
          true,
          `${ExpectedMessages.responseTextIsValid}${modelId}`,
        );
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

  public async assertResponseAudioAttachment(
    response: APIResponse,
    modelId: string,
  ) {
    const respBody = await response.text();
    const result = respBody.match(ExpectedConstants.responseFileUrlPattern);
    const audioUrl = result ? result[0] : undefined;
    expect
      .soft(
        audioUrl,
        `${ExpectedMessages.audioUrlReturnedInResponse}${modelId}`,
      )
      .toBeDefined();
    expect
      .soft(
        audioUrl?.length ?? 0,
        `${ExpectedMessages.audioUrlReturnedInResponse}${modelId}`,
      )
      .toBeGreaterThan(0);
  }

  public assertRequestModelId(
    request: ChatBody,
    expectedModel: DialAIEntityModel | ConversationEntityModel,
  ) {
    this.assertValue(
      request.model?.id,
      expectedModel.id,
      ExpectedMessages.requestModeIdIsValid,
    );
  }

  public assertRequestTemperature(
    request: ChatBody,
    expectedTemperature: number | undefined,
  ) {
    this.assertValue(
      request.temperature,
      expectedTemperature,
      ExpectedMessages.requestTempIsValid,
    );
  }

  public assertRequestPrompt(
    request: ChatBody,
    expectedPrompt: string | undefined,
  ) {
    if (expectedPrompt === undefined) {
      expect
        .soft(request.prompt, ExpectedMessages.requestPromptIsValid)
        .toBeUndefined();
    } else {
      this.assertValue(
        request.prompt,
        expectedPrompt,
        ExpectedMessages.requestPromptIsValid,
      );
    }
  }

  public assertRequestResponseFormat(
    request: Conversation,
    expectedFormat: ConversationResponseFormat | undefined,
  ) {
    this.assertValue(
      request.responseFormat,
      expectedFormat,
      ExpectedMessages.requestResponseFormatIsValid,
    );
  }

  public verifyRequestAttachments(
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

  public assertRequestMessage(
    requestMessage: Message,
    expectedMessage: string,
  ) {
    this.assertValue(
      requestMessage.content,
      expectedMessage,
      ExpectedMessages.chatRequestMessageIsValid,
    );
  }

  public assertMoveRequest(
    request: MoveModel,
    expectedDestination: string,
    expectedSource: string,
    isOverwritten = false,
  ) {
    this.assertBooleanCondition(
      request.destinationUrl.endsWith(`/${expectedDestination}`),
      true,
      ExpectedMessages.moveDestinationIsValid,
    );
    this.assertBooleanCondition(
      request.sourceUrl.endsWith(`/${expectedSource}`),
      true,
      ExpectedMessages.moveSourceIsValid,
    );

    isOverwritten
      ? this.assertBooleanCondition(
          isOverwritten,
          true,
          ExpectedMessages.moveSourceIsValid,
        )
      : this.assertBooleanCondition(
          isOverwritten,
          false,
          ExpectedMessages.moveOverwriteIsValid,
        );
  }

  public assertEntityUrl(entity: BackendEntity, expectedUrl: string) {
    const expectedEntityNameIndex =
      expectedUrl.lastIndexOf(ItemUtil.entityIdSeparator) +
      ItemUtil.entityIdSeparator.length;
    const expectedEntityName = expectedUrl.substring(expectedEntityNameIndex);
    const expectedEncodedName = ItemUtil.getEncodedItemId(expectedEntityName);
    this.assertValue(
      entity.url,
      expectedUrl.replace(expectedEntityName, expectedEncodedName),
      ExpectedMessages.entityUrlIsValid,
    );
  }
}
