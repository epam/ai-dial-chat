import { DEFAULT_LOCAL } from '@/src/constants/locale';

/**
 * Holds the locale configuration resolved from the env config
 * (`AVAILABLE_LOCALES` -> `SettingsState.availableLocales`).
 *
 * Seeded once in `createStore` before any render, so it can be read
 * synchronously from anywhere in the client codebase (utils, selectors,
 * components) without threading the value through the store.
 */
export class LocalesService {
  private static availableLocales: string[] = [DEFAULT_LOCAL];

  public static setAvailableLocales(locales?: string[]): void {
    this.availableLocales = locales?.length ? locales : [DEFAULT_LOCAL];
  }

  public static getAvailableLocales(): string[] {
    return this.availableLocales;
  }

  /**
   * The first locale of `availableLocales`. Used as the entity identifier
   * locale for marketplace entities (applications, toolsets, models).
   *
   * Unlike the current UI locale, this never changes at runtime.
   */
  public static getPrimaryLocale(): string {
    return this.availableLocales[0];
  }
}
