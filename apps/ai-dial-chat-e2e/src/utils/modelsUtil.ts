import { OpenAIEntityModel } from '@/ai-dial-chat/types/openai';

export class ModelsUtil {
  public static getOpenAIEntities() {
    return JSON.parse(process.env.MODELS!) as OpenAIEntityModel[];
  }

  public static getAddons() {
    return JSON.parse(process.env.ADDONS!) as OpenAIEntityModel[];
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

  public static getModel(model: string) {
    return ModelsUtil.getModels().find((a) => a.id === model);
  }

  public static getDefaultModel() {
    return ModelsUtil.getModels().find((a) => a.isDefault === true);
  }

  public static getApplication(appId: string) {
    return ModelsUtil.getApplications().find((a) => a.id === appId);
  }

  public static getApplicationDescription(application: OpenAIEntityModel) {
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
    application: OpenAIEntityModel,
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
    application: OpenAIEntityModel,
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
    const selectedAddons: OpenAIEntityModel[] = [];
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
}
