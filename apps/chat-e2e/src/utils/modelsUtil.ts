import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import {
  doesModelAllowSystemPrompt,
  doesModelAllowTemperature,
} from '@/chat/utils/app/models';
import { modelsFilePath } from '@/src/core/testPaths';
import { ApplicationTypes, ModelTopic } from '@/src/testData';
import * as fs from 'fs';

export class ModelsUtil {
  private static readonly slowModelIds: string[] = process.env.SLOW_MODELS_IDS
    ? JSON.parse(process.env.SLOW_MODELS_IDS)
    : [];

  public static getOpenAIEntities() {
    return JSON.parse(
      fs.readFileSync(modelsFilePath, 'utf-8'),
    ) as DialAIEntityModel[];
  }

  public static getLatestOpenAIEntities(
    allOpenAIEntities?: DialAIEntityModel[],
  ): DialAIEntityModel[] {
    const entities = allOpenAIEntities ?? ModelsUtil.getOpenAIEntities();
    const uniqueEntitiesMap = new Map<string, DialAIEntityModel>();
    entities.forEach((entity) => {
      if (!uniqueEntitiesMap.has(entity.name)) {
        uniqueEntitiesMap.set(entity.name, entity);
      }
    });
    return Array.from(uniqueEntitiesMap.values());
  }

  private static filterEntities(
    source: DialAIEntityModel[],
    entityType: EntityType,
    excludedEntityIds?: string[],
  ): DialAIEntityModel[] {
    let entities = source.filter((e) => e.type === entityType);
    if (excludedEntityIds) {
      entities = entities.filter((e) => !excludedEntityIds.includes(e.id));
    }
    return entities;
  }

  public static getLatestEntities(
    entityType: EntityType,
    excludedEntityIds?: string[],
  ): DialAIEntityModel[] {
    return this.filterEntities(
      ModelsUtil.getLatestOpenAIEntities(),
      entityType,
      excludedEntityIds,
    );
  }

  private static getEntities(
    entityType: EntityType,
    excludedEntityIds?: string[],
  ): DialAIEntityModel[] {
    return this.filterEntities(
      ModelsUtil.getOpenAIEntities(),
      entityType,
      excludedEntityIds,
    );
  }

  public static getLatestModels(excludeSlowModels = true) {
    if (excludeSlowModels) {
      return this.getLatestEntities(EntityType.Model, this.slowModelIds);
    }
    return this.getLatestEntities(EntityType.Model);
  }

  public static getLatestApplications() {
    return this.getLatestEntities(EntityType.Application);
  }

  public static getModels(excludeSlowModels = true) {
    if (excludeSlowModels) {
      return this.getEntities(EntityType.Model, this.slowModelIds);
    }
    return this.getEntities(EntityType.Model);
  }

  public static getApplications() {
    return this.getEntities(EntityType.Application);
  }

  public static getOpenAIEntity(entity: string) {
    return ModelsUtil.getOpenAIEntities().find((e) => e.id === entity);
  }

  public static getModel(modelId: string) {
    return ModelsUtil.getModels(false).find((a) => a.id === modelId);
  }

  public static getDefaultAgent() {
    return ModelsUtil.getOpenAIEntities().find((a) => a.isDefault);
  }

  public static doesModelAllowSystemPrompt(
    model: DialAIEntityModel | undefined,
  ) {
    return doesModelAllowSystemPrompt(model);
  }

  public static doesModelAllowTemperature(
    model: DialAIEntityModel | undefined,
  ) {
    return doesModelAllowTemperature(model);
  }

  public static getModelsWithoutAttachment() {
    return ModelsUtil.getModels().filter(
      (m) =>
        m.inputAttachmentTypes === undefined ||
        m.inputAttachmentTypes.length === 0,
    );
  }

  public static getLatestModelsWithAttachment(
    excludeSlowModels = true,
    attachmentTypes?: string[],
    // null = require model.maxInputAttachments to be undefined (no attachment limit)
    maxInputAttachments?: number | null,
  ): DialAIEntityModel[] {
    return ModelsUtil.getLatestModels(excludeSlowModels).filter((model) => {
      if (!model.inputAttachmentTypes?.length) {
        return false;
      }
      if (maxInputAttachments !== undefined) {
        if (maxInputAttachments === null) {
          if (model.maxInputAttachments !== undefined) return false;
        } else {
          if (model.maxInputAttachments !== maxInputAttachments) return false;
        }
      }
      if (!attachmentTypes?.length) {
        return true;
      }
      return model.inputAttachmentTypes.some((supportedType) =>
        attachmentTypes.includes(supportedType),
      );
    });
  }

  public static getApplication(appId: string) {
    return ModelsUtil.getApplications().find((a) => a.id === appId);
  }

  public static getApplicationDescription(application: DialAIEntityModel) {
    const description = application.description;
    return description
      ? description
          .replaceAll(/\((?<=\().*?(?=\))\)/g, '')
          .replaceAll(/\[|\]/g, '')
          .replaceAll('\n\n', '')
          .replaceAll('.\n', '. ')
          .replaceAll('\n', '')
      : '';
  }

  public static getApplicationDescriptionLinkAnchors(
    application: DialAIEntityModel,
  ) {
    const description = application!.description;
    const linkAnchorRegex = /\[(.*?)\]/g;
    return description
      ? description
          .match(linkAnchorRegex)
          ?.map((l) => l.replaceAll(/\[|\]/g, '').toString())
      : [];
  }

  public static getApplicationDescriptionLink(
    application: DialAIEntityModel,
    linkAnchor: string,
  ) {
    const description = application!.description;
    const linkRegex = new RegExp(`\\[(${linkAnchor}?)]\\((http.*?)\\)`);
    let link = '';
    if (description) {
      const matches = description.match(linkRegex)?.map((l) => l.toString());
      if (matches) {
        link = matches[matches.length - 1];
      }
    }
    return link;
  }

  public static getRecentModelIds(): string[] {
    return process.env.RECENT_MODELS !== 'undefined'
      ? JSON.parse(process.env.RECENT_MODELS!)
      : [];
  }

  public static groupEntitiesByName(entities: DialAIEntityModel[]) {
    return entities.reduce((groupMap, entity) => {
      if (!groupMap.has(entity.name)) {
        groupMap.set(entity.name, []);
      }
      const group = groupMap.get(entity.name);
      group?.push(entity);
      return groupMap;
    }, new Map<string, DialAIEntityModel[]>());
  }

  public static getEntityName(entity: DialAIEntityModel) {
    if (entity.version !== undefined) {
      return entity.id.includes(entity.version)
        ? entity.name
        : `${entity.name} ${entity.version}`;
    } else {
      return entity.name;
    }
  }

  public static getModelForSimpleRequest() {
    return process.env.SIMPLE_REQUEST_MODEL
      ? ModelsUtil.getModel(process.env.SIMPLE_REQUEST_MODEL)
      : undefined;
  }

  public static getRecentAgents(recentAgentIds: string[]) {
    const allAgents = ModelsUtil.getOpenAIEntities();
    return allAgents.filter((a) =>
      recentAgentIds.includes(a.reference || a.id),
    );
  }

  public static getRecentAgentsNames(recentAgentIds: string[]) {
    return ModelsUtil.getRecentAgents(recentAgentIds).map(({ name }) => name);
  }

  public static getRecentAgentsVersions(recentAgentIds: string[]) {
    return ModelsUtil.getRecentAgents(recentAgentIds)
      .filter((r) => r.version !== undefined)
      .map(({ version }) => version ?? '');
  }

  public static getApplicationType(entity: DialAIEntityModel) {
    if (entity.applicationTypeSchemaId) {
      return entity.applicationTypeSchemaId;
    }
    if (ModelsUtil.isExecutableApp(entity)) return ApplicationTypes.CODE_APP;
    return ApplicationTypes.CUSTOM_APP;
  }

  public static isExecutableApp(entity: DialAIEntityModel) {
    return !!entity.functionStatus;
  }

  public static getAgentsWithSimpleDescription(agents?: DialAIEntityModel[]) {
    agents = agents ?? ModelsUtil.getOpenAIEntities();
    //define all patterns
    const htmlTagRegExp = /<[^>]*>/g;
    const markdownLinkRegExp = /\[([^\]]+)\]\(([^)]+)\)/g;
    const markdownBoldRegExp = /\*\*(.*?)\*\*/g;

    return agents.filter((agent) => {
      const description = agent.description ?? '';
      //check if the string match any of the patterns
      const hasHtmlTag = description.match(htmlTagRegExp);
      const hasMarkdownLink = description.match(markdownLinkRegExp);
      const hasMarkdownBold = description.match(markdownBoldRegExp);
      return !hasHtmlTag && !hasMarkdownLink && !hasMarkdownBold;
    });
  }

  /**
   * Filters models/entities by topic
   * @param entities - Array of entities to filter (output of other ModelsUtil methods)
   * @param topic - Topic to filter by (from ModelTopic enum)
   * @returns Filtered array of entities that have the specified topic
   */
  public static filterByTopic(
    entities: DialAIEntityModel[],
    topic: ModelTopic,
  ): DialAIEntityModel[] {
    return entities.filter((entity) => entity.topics?.includes(topic));
  }
}
