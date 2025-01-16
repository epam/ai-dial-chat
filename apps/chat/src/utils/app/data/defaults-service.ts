export interface Defaults {
  assistantSubmodelId: string;
  quickAppsHost: string;
  quickAppsModel: string;
  quickAppsSchemaId: string;
  dialApiHost: string;
  defaultSystemPrompt: string;
}

export class DefaultsService {
  private static defaults: Map<keyof Defaults, Defaults[keyof Defaults]>;

  public static setDefaults(defaults: Defaults) {
    this.defaults = new Map(
      Object.entries(defaults) as [keyof Defaults, Defaults[keyof Defaults]][],
    );
  }

  public static get(key: keyof Defaults): string | undefined;
  public static get(
    key: keyof Defaults,
    defaultValue: Defaults[keyof Defaults],
  ): string;
  public static get(
    key: keyof Defaults,
    defaultValue?: Defaults[keyof Defaults],
  ) {
    return this.defaults?.get(key) ?? defaultValue;
  }
}
