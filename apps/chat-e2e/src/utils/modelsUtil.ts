import { DialAIEntityModel } from '@/chat/types/models';

export class ModelsUtil {
  public static getOpenAIEntities() {
    return JSON.parse(process.env.MODELS!) as DialAIEntityModel[];
  }

  public static getLatestOpenAIEntities() {
    const latestOpenAIEntities: DialAIEntityModel[] = [];
    const allOpenAIEntities = ModelsUtil.getOpenAIEntities();
    const recentModels = ModelsUtil.getRecentModelIds();
    let groupedOpenAIEntities = allOpenAIEntities.map((object) => ({
      key: object.name,
      object: object,
    }));
    for (const recentModelId of recentModels) {
      const groupedOpenAIEntity = groupedOpenAIEntities.find(
        (e) => e.object.id === recentModelId,
      );
      if (groupedOpenAIEntity) {
        latestOpenAIEntities.push(groupedOpenAIEntity.object);
        groupedOpenAIEntities = groupedOpenAIEntities.filter(
          (e) => e.key !== groupedOpenAIEntity.key,
        );
      }
    }
    groupedOpenAIEntities.forEach((e) => {
      if (!latestOpenAIEntities.find((le) => le.name === e.key)) {
        latestOpenAIEntities.push(e.object);
      }
    });
    return latestOpenAIEntities;
  }

  public static getAddons() {
    return JSON.parse(process.env.ADDONS!) as DialAIEntityModel[];
  }

  public static getLatestModels() {
    return ModelsUtil.getLatestOpenAIEntities().filter(
      (e) => e.type === 'model',
    );
  }

  public static getLatestAssistants() {
    return ModelsUtil.getLatestOpenAIEntities().filter(
      (e) => e.type === 'assistant',
    );
  }

  public static getLatestApplications() {
    return ModelsUtil.getLatestOpenAIEntities().filter(
      (e) => e.type === 'application',
    );
  }

  public static getModels() {
    return ModelsUtil.getOpenAIEntities().filter((e) => e.type === 'model');
  }

  public static getAssistants() {
    return ModelsUtil.getOpenAIEntities().filter((e) => e.type === 'assistant');
  }

  public static getApplications() {
    return ModelsUtil.getOpenAIEntities().filter(
      (e) => e.type === 'application',
    );
  }

  public static getOpenAIEntity(entity: string) {
    return ModelsUtil.getOpenAIEntities().find((e) => e.id === entity);
  }

  public static getModel(modelId: string) {
    return ModelsUtil.getModels().find((a) => a.id === modelId);
  }

  public static getDefaultModel() {
    return ModelsUtil.getModels().find((a) => a.isDefault);
  }

  public static getModelsWithoutSystemPrompt() {
    return ModelsUtil.getModels()
      .filter((m) => m.features?.systemPrompt === false)
      .map((m) => m.id);
  }

  public static getModelsWithoutAttachment() {
    return ModelsUtil.getModels().filter(
      (m) => m.inputAttachmentTypes === undefined,
    );
  }

  public static getLatestModelsWithAttachment() {
    return ModelsUtil.getLatestModels().filter(
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
}
