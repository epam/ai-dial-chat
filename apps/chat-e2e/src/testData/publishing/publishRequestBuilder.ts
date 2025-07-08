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

  withEntityResource(
    entity: Conversation | Prompt,
    action: PublishActions,
    targetResource: string,
    entityType: 'conversations' | 'prompts',
    version?: string,
  ): PublishRequestBuilder {
    const targetUrl = `${entityType}/${this.getPublishRequest().targetFolder}${targetResource}__${version ?? ExpectedConstants.defaultAppVersion}`;
    let resource: PublicationResource = {
      action: action,
      targetUrl: targetUrl,
    };
    if (action === 'ADD' || action === 'ADD_IF_ABSENT') {
      resource = {
        ...resource,
        sourceUrl: entity.id,
      };
    }
    this.publishRequest.resources.push(resource);
    return this;
  }

  withConversationWithoutFolderResource(
    conversation: Conversation,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = this.getEntityWithoutFolderTargetResource(
      conversation.id,
    );
    return this.withEntityResource(
      conversation,
      action,
      targetResource,
      'conversations',
      version,
    );
  }

  withConversationInFolderResource(
    conversation: Conversation,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = this.getEntityInFolderTargetResource(
      conversation.id,
    );
    return this.withEntityResource(
      conversation,
      action,
      targetResource,
      'conversations',
      version,
    );
  }

  withPromptInFolderResource(
    prompt: Prompt,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = this.getEntityInFolderTargetResource(prompt.id);
    return this.withEntityResource(
      prompt,
      action,
      targetResource,
      'prompts',
      version,
    );
  }

  withPromptWithoutFolderResource(
    prompt: Prompt,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = this.getEntityWithoutFolderTargetResource(prompt.id);
    return this.withEntityResource(
      prompt,
      action,
      targetResource,
      'prompts',
      version,
    );
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
    attachment: Attachment | string,
    action: PublishActions,
  ): PublishRequestBuilder {
    const title =
      typeof attachment === 'string'
        ? attachment.substring(attachment.lastIndexOf('/') + 1)
        : attachment.title;
    let resource: PublicationResource = {
      action: action,
      targetUrl: `files/${this.getPublishRequest().targetFolder}${title}`,
    };
    if (action === 'ADD' || action === 'ADD_IF_ABSENT') {
      resource = {
        ...resource,
        sourceUrl: typeof attachment === 'string' ? attachment : attachment.url,
      };
    }
    this.publishRequest.resources.push(resource);
    return this;
  }

  withRule(rule: PublicationRule): PublishRequestBuilder {
    this.publishRequest.rules?.push(rule);
    return this;
  }

  private getEntityWithoutFolderTargetResource(resourceId: string): string {
    const segments = resourceId.split('/');
    return segments[segments.length - 1];
  }

  private getEntityInFolderTargetResource(resourceId: string): string {
    return resourceId.split('/').slice(2).join('/');
  }

  build(): PublicationRequestModel {
    const publishRequest = { ...this.publishRequest };
    this.reset();
    return publishRequest;
  }
}
