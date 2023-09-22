import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';

import { APIRequestContext } from '@playwright/test';

export class ApiHelper {
  private static requestTimeout = 10000;
  private request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  public async getModelNames() {
    const allEntities = await this.getModels();
    return allEntities.filter((e) => e.type === 'model').map((m) => m.name);
  }

  public async getEntity(entity: OpenAIEntityModel) {
    const allEntities = await this.getModels();
    return allEntities.find((e) => e.id === entity.id);
  }

  public async getApplicationNames() {
    const allEntities = await this.getModels();
    return allEntities
      .filter((e) => e.type === 'application')
      .map((app) => app.name);
  }

  public async getAddonNameById(addonId: string) {
    const allEntities = await this.getAddons();
    return allEntities.find((e) => e.type === 'addon' && e.id === addonId);
  }

  public async getAssistant(assistant: string) {
    const allEntities = await this.getModels();
    return allEntities.find(
      (e) => e.type === 'assistant' && e.name === assistant,
    );
  }

  public async getApplication(app: string) {
    const allEntities = await this.getModels();
    return allEntities.find((e) => e.type === 'application' && e.name === app);
  }

  public async getApplicationDescription(app: string) {
    const application = await this.getApplication(app);
    const description = application!.description;
    return description
      ? description
          .replaceAll(/\((?<=\().*?(?=\))\)/g, '')
          .replaceAll(/\[|\]/g, '')
          .replaceAll('\n\n', '')
          .replaceAll('.\n', '. ')
          .replaceAll('\n', '')
      : '';
  }

  public async getApplicationDescriptionLinkAnchors(
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

  public async getApplicationDescriptionLink(
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

  public async getEntitySelectedAddons(entity: string) {
    const allEntities = await this.getModels();
    const entityObject = allEntities.find((e) => e.name === entity);
    const selectedAddons: string[] = [];
    const entityAddonObjects = entityObject!.selectedAddons;
    if (entityAddonObjects) {
      const allAddons = await this.getAddons();
      entityAddonObjects.forEach((addonId) => {
        selectedAddons.push(allAddons.find((a) => a.id === addonId)!.name);
      });
    }
    return selectedAddons;
  }

  public async getModels() {
    const response = await this.request.get('/api/models', {
      failOnStatusCode: true,
      timeout: ApiHelper.requestTimeout,
    });
    const body: OpenAIEntityModel[] = JSON.parse(await response.text());
    return body;
  }

  public async getAddons() {
    const response = await this.request.get('/api/addons', {
      failOnStatusCode: true,
      timeout: ApiHelper.requestTimeout,
    });
    const body: OpenAIEntityAddon[] = JSON.parse(await response.text());
    return body;
  }
}
