import { Conversation } from '@/chat/types/chat';
import { ApiKeys, BackendEntity } from '@/chat/types/common';
import { Prompt } from '@/chat/types/prompt';
import {
  PublicationRequestModel,
  PublicationRule,
} from '@/chat/types/publication';
import { ExpectedConstants } from '@/src/testData';
import { ItemUtil } from '@/src/utils';
import { Attachment, PublishActions, Toolset } from '@epam/ai-dial-shared';

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
    sourceUrl: string,
    version?: string,
  ): PublishRequestBuilder {
    const versionSuffix = version
      ? `${ItemUtil.entityIdSeparator}${version}`
      : '';
    const targetUrl = `${entityType}/${this.getPublishRequest().targetFolder}${targetResource}${versionSuffix}`;
    const resource = {
      action,
      targetUrl,
      sourceUrl,
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
      version ?? ExpectedConstants.defaultEntityVersion,
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
      version ?? ExpectedConstants.defaultEntityVersion,
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
      version ?? ExpectedConstants.defaultEntityVersion,
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
      version ?? ExpectedConstants.defaultEntityVersion,
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

  withToolsetResource(
    toolset: Toolset,
    action: PublishActions,
  ): PublishRequestBuilder {
    return this.withEntityResource(
      action,
      ApiKeys.Toolsets,
      toolset.display_name,
      toolset.id!,
      toolset.display_version,
    );
  }

  withFileResource(
    attachment: Attachment | string,
    action: PublishActions,
    //That is not a folder in the Organization structure
    //but the same folder that conversation belongs to
    targetFolder?: string,
  ): PublishRequestBuilder {
    const title =
      typeof attachment === 'string'
        ? attachment.substring(attachment.lastIndexOf('/') + 1)
        : attachment.title;
    const targetResource =
      targetFolder === undefined
        ? title
        : targetFolder.endsWith('/')
          ? `${targetFolder}${title}`
          : `${targetFolder}/${title}`;
    const sourceUrl =
      typeof attachment === 'string' ? attachment : attachment.url!;
    return this.withEntityResource(
      action,
      ApiKeys.Files,
      targetResource,
      sourceUrl,
    );
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
