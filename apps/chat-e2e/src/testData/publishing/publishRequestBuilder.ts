import { Conversation } from '@/chat/types/chat';
import {
  PublicationRequestModel,
  PublicationRule,
} from '@/chat/types/publication';
import { ExpectedConstants } from '@/src/testData';
import { Attachment, PublishActions } from '@epam/ai-dial-shared';

export interface PublicationResource {
  action: PublishActions;
  sourceUrl?: string;
  targetUrl: string;
}

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
    //remove leading and ending slashes
    path = path.replace(/^\/+|\/+$/g, '');
    //check root folder ending slash exists
    const rootFolder = this.publishRequest.targetFolder.endsWith('/')
      ? this.publishRequest.targetFolder
      : this.publishRequest.targetFolder.concat('/');
    this.publishRequest.targetFolder = rootFolder.concat(`${path}/`);
    return this;
  }

  withConversationResource(
    conversation: Conversation,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = conversation.id.split('/').slice(2).join('/');
    const targetUrl = `conversations/${this.getPublishRequest().targetFolder}${targetResource}__${version ?? ExpectedConstants.defaultAppVersion}`;
    let resource: PublicationResource = {
      action: action,
      targetUrl: targetUrl,
    };
    if (action === 'ADD' || action === 'ADD_IF_ABSENT') {
      resource = {
        ...resource,
        sourceUrl: conversation.id,
      };
    }
    this.publishRequest.resources.push(resource);
    return this;
  }

  withFileResource(
    attachment: Attachment,
    action: PublishActions,
  ): PublishRequestBuilder {
    let resource: PublicationResource = {
      action: action,
      targetUrl: `files/${this.getPublishRequest().targetFolder}${attachment.title}`,
    };
    if (action === 'ADD' || action === 'ADD_IF_ABSENT') {
      resource = {
        ...resource,
        sourceUrl: attachment.url,
      };
    }
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
