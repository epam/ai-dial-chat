import { Conversation } from '@/chat/types/chat';
import { ApiKeys, BackendEntity } from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
import {
  PublicationRequestModel,
  PublicationRule,
} from '@/chat/types/publication';
import { ExpectedConstants } from '@/src/testData';
import { ItemUtil } from '@/src/utils';
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
    action: PublishActions,
    entityType: ApiKeys,
    targetResource: string,
    sourceUrl?: string,
    version?: string,
  ): PublishRequestBuilder {
    const versionSuffix = version
      ? `${ItemUtil.entityIdSeparator}${version}`
      : '';
    const targetUrl = `${entityType}/${this.getPublishRequest().targetFolder}${targetResource}${versionSuffix}`;
    const resource: PublicationResource = {
      action,
      targetUrl,
      ...(action === 'ADD' || (action === 'ADD_IF_ABSENT' && sourceUrl)
        ? { sourceUrl }
        : {}),
    };
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
      action,
      ApiKeys.Conversations,
      targetResource,
      conversation.id,
      version ?? ExpectedConstants.defaultAppVersion,
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
      action,
      ApiKeys.Conversations,
      targetResource,
      conversation.id,
      version ?? ExpectedConstants.defaultAppVersion,
    );
  }

  withPromptInFolderResource(
    prompt: Prompt,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = this.getEntityInFolderTargetResource(prompt.id);
    return this.withEntityResource(
      action,
      ApiKeys.Prompts,
      targetResource,
      prompt.id,
      version ?? ExpectedConstants.defaultAppVersion,
    );
  }

  withPromptWithoutFolderResource(
    prompt: Prompt,
    action: PublishActions,
    version?: string,
  ): PublishRequestBuilder {
    const targetResource = this.getEntityWithoutFolderTargetResource(prompt.id);
    return this.withEntityResource(
      action,
      ApiKeys.Prompts,
      targetResource,
      prompt.id,
      version ?? ExpectedConstants.defaultAppVersion,
    );
  }

  withApplicationResource(
    application: BackendEntity,
    action: PublishActions,
  ): PublishRequestBuilder {
    return this.withEntityResource(
      action,
      ApiKeys.Applications,
      application.name,
      application.url,
    );
  }

  withFileResource(
    attachment: Attachment | string,
    action: PublishActions,
  ): PublishRequestBuilder {
    const title =
      typeof attachment === 'string'
        ? attachment.substring(attachment.lastIndexOf('/') + 1)
        : attachment.title;
    const sourceUrl =
      typeof attachment === 'string' ? attachment : attachment.url;
    return this.withEntityResource(action, ApiKeys.Files, title, sourceUrl);
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
