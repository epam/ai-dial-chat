import { Attachment, Conversation } from '@/chat/types/chat';
import {
  PublicationRequestModel,
  PublicationRule,
  PublishActions,
} from '@/chat/types/publication';
import { ExpectedConstants } from '@/src/testData';

export class PublishRequestBuilder {
  private publishRequest: PublicationRequestModel;

  getPublishRequest(): PublicationRequestModel {
    return this.publishRequest;
  }

  constructor() {
    this.publishRequest = this.reset();
  }

  private reset(): PublicationRequestModel {
    this.publishRequest = {
      name: '',
      targetFolder: ExpectedConstants.rootPublicationFolder,
      resources: [],
      rules: [],
    };
    return this.publishRequest;
  }

  withName(name: string): PublishRequestBuilder {
    this.publishRequest.name = name;
    return this;
  }

  withTargetFolder(path: string): PublishRequestBuilder {
    this.publishRequest.targetFolder = path;
    return this;
  }

  withConversationResource(
    conversation: Conversation,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = conversation.id.substring(
      conversation.id.lastIndexOf('/') + 1,
    );
    const resource = {
      action: PublishActions.ADD,
      sourceUrl: conversation.id,
      targetUrl: `conversations/${this.getPublishRequest().targetFolder}${targetResource}__${version ?? ExpectedConstants.defaultAppVersion}`,
    };
    this.publishRequest.resources.push(resource);
    return this;
  }

  withFileResource(attachment: Attachment): PublishRequestBuilder {
    const resource = {
      action: PublishActions.ADD,
      sourceUrl: attachment.url,
      targetUrl: `files/${this.getPublishRequest().targetFolder}${attachment.title}`,
    };
    this.publishRequest.resources.push(resource);
    return this;
  }

  withRule(rule: PublicationRule): PublishRequestBuilder {
    this.publishRequest.rules?.push(rule);
    return this;
  }

  build(): PublicationRequestModel {
    const publishRequest = { ...this.publishRequest };
    this.reset();
    return publishRequest;
  }
}
