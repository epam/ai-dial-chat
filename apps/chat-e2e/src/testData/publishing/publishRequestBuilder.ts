import { Conversation } from '@/chat/types/chat';
import { BackendEntity } from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
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
      displayAuthor: '',
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

  withDisplayAuthor(displayAuthor: string): PublishRequestBuilder {
    this.publishRequest.displayAuthor = displayAuthor;
    return this;
  }

  withTargetFolder(path: string): PublishRequestBuilder {
    //remove leading and ending slashes
    path = path.replace(/^\/+|\/+$/g, '');
    //check root folder ending slash exists
    const rootFolder = this.publishRequest.targetFolder.endsWith('/')
      ? this.publishRequest.targetFolder
      : this.publishRequest.targetFolder.concat('/');
    this.publishRequest.targetFolder =
      path !== '' ? rootFolder.concat(`${path}/`) : rootFolder;
    return this;
  }

  withConversationWithoutFolderResource(
    conversation: Conversation,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const conversationIdSegments = conversation.id.split('/');
    const targetResource =
      conversationIdSegments[conversationIdSegments.length - 1];
    return this.withConversationResource(
      conversation,
      action,
      targetResource,
      version,
    );
  }

  withConversationInFolderResource(
    conversation: Conversation,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = conversation.id.split('/').slice(2).join('/');
    return this.withConversationResource(
      conversation,
      action,
      targetResource,
      version,
    );
  }

  withConversationResource(
    conversation: Conversation,
    action: PublishActions,
    targetResource: string,
    version?: string,
  ): PublishRequestBuilder {
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

  withPromptResource(
    prompt: Prompt,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = prompt.id.substring(prompt.folderId.length + 1);
    const targetUrl = `prompts/${this.getPublishRequest().targetFolder}${targetResource}__${version ?? ExpectedConstants.defaultAppVersion}`;
    let resource: PublicationResource = {
      action: action,
      targetUrl: targetUrl,
    };
    if (action === 'ADD' || action === 'ADD_IF_ABSENT') {
      resource = {
        ...resource,
        sourceUrl: prompt.id,
      };
    }
    this.publishRequest.resources.push(resource);
    return this;
  }

  withApplicationResource(
    application: BackendEntity,
    action: PublishActions,
  ): PublishRequestBuilder {
    const targetUrl = `applications/${this.getPublishRequest().targetFolder}${application.name}`;
    let resource: PublicationResource = {
      action: action,
      targetUrl: targetUrl,
    };
    if (action === 'ADD' || action === 'ADD_IF_ABSENT') {
      resource = {
        ...resource,
        sourceUrl: application.url,
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
