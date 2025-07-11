import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import {
  doesModelAllowAddons,
  doesModelAllowSystemPrompt,
  doesModelAllowTemperature,
} from '@/chat/utils/app/models';
import { ApplicationTypes } from '@/src/testData';

export class ModelsUtil {
  private static readonly slowModelIds: string[] = process.env.SLOW_MODELS_IDS
    ? JSON.parse(process.env.SLOW_MODELS_IDS)
    : [];

  public static getOpenAIEntities() {
    return JSON.parse(process.env.MODELS!) as DialAIEntityModel[];
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

  public static getAddons() {
    return JSON.parse(process.env.ADDONS!) as DialAIEntityModel[];
  }

  public static getLatestModels(excludeSlowModels = true) {
    if (excludeSlowModels) {
      return this.getLatestEntities(EntityType.Model, this.slowModelIds);
    }
    return this.getLatestEntities(EntityType.Model);
  }

  public static getLatestAssistants() {
    return this.getLatestEntities(EntityType.Assistant);
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

  public static getAssistants() {
    return this.getEntities(EntityType.Assistant);
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

  public static doesModelAllowAddons(model: DialAIEntityModel | undefined) {
    return doesModelAllowAddons(model);
  }

  public static getModelsWithoutAttachment() {
    return ModelsUtil.getModels().filter(
      (m) => m.inputAttachmentTypes === undefined,
    );
  }

  public static getLatestModelsWithAttachment(excludeSlowModels = true) {
    return ModelsUtil.getLatestModels(excludeSlowModels).filter(
      (m) => m.inputAttachmentTypes !== undefined,
    );
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

  public static getOpenAIEntitySelectedAddons(entityId: string) {
    const allEntities = ModelsUtil.getOpenAIEntities();
    const entityObject = allEntities.find((e) => e.id === entityId);
    const selectedAddons: DialAIEntityModel[] = [];
    const entityAddonObjects = entityObject!.selectedAddons;
    if (entityAddonObjects) {
      const allAddons = ModelsUtil.getAddons();
      entityAddonObjects.forEach((addonId) => {
        selectedAddons.push(allAddons.find((a) => a.id === addonId)!);
      });
    }
    return selectedAddons;
  }

  public static getAddon(addonId: string) {
    return ModelsUtil.getAddons().find((a) => a.id === addonId);
  }

  public static getAssistant(assistantId: string) {
    return ModelsUtil.getAssistants().find((a) => a.id === assistantId);
  }

  public static getRecentModelIds(): string[] {
    return process.env.RECENT_MODELS !== 'undefined'
      ? JSON.parse(process.env.RECENT_MODELS!)
      : [];
  }

  public static getRecentAddonIds(): string[] {
    return process.env.RECENT_ADDONS !== 'undefined'
      ? JSON.parse(process.env.RECENT_ADDONS!)
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
}
