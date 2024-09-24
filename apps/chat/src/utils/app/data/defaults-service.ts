export interface Defaults {
  assistantSubmodelId: string;
}

export class DefaultsService {
  private static defaults: Map<keyof Defaults, Defaults[keyof Defaults]>;

  public static setDefaults(defaults: Defaults) {
    this.defaults = new Map(
      Object.entries(defaults) as [keyof Defaults, Defaults[keyof Defaults]][],
    );
  }

  public static get(
    key: keyof Defaults,
    defaultValue?: Defaults[keyof Defaults],
  ) {
    return this.defaults?.get(key) ?? defaultValue;
  }
}
