import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_LOCALE_PATTERN,
  IsBcp47LocaleList,
  parseContentLocaleList,
} from '../content-locales';
import { IFRAME_ORIGIN_PATTERN } from './env-patterns';

/** Values forwarded to the client: announcements, deployment defaults, visualizers, overlay and UI features. */
export class ClientUiEnv {
  @IsOptional()
  @IsString()
  DEFAULT_DEPLOYMENT?: string;

  @IsOptional()
  @IsString()
  CUSTOM_CLIENT_VARIABLES?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENT_HTML_MESSAGE?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENT_TITLE?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENT_DESCRIPTION?: string;

  @IsOptional()
  @IsString()
  ANNOUNCEMENTS?: string;

  @IsOptional()
  @IsString()
  FOOTER_HTML_MESSAGE?: string;

  @IsOptional()
  @IsString()
  WELCOME_SCREEN_DESCRIPTION?: string;

  /* Deliberately unconstrained: this is an opaque display string, and CI
   * stamps take many shapes (0.45.0, 0.45.0-rc.3, 2026.08.10+a1b2c3d).
   * Outbound HTTP metadata uses a separately normalized representation. */
  @IsOptional()
  @IsString()
  CHAT_VERSION?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  FEATURED_MODEL_IDS?: string[] = [];

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  HIDDEN_ENTITY_TAGS?: string[] = [];

  @IsOptional()
  @IsUrl({ require_tld: false })
  DEV_QUICKAPPS_EDITOR_URL?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @Matches(IFRAME_ORIGIN_PATTERN, {
    each: true,
    message:
      'Each allowed iframe origin must be an origin URL (scheme://host[:port], no path or query string) or a single leading-wildcard-label pattern (scheme://*.host[:port])',
  })
  ALLOWED_IFRAME_ORIGINS?: string[] = [];

  @IsOptional()
  @Transform(({ obj, key }) => {
    /* Reads the raw source value (not `value`, which class-transformer's
     * `enableImplicitConversion` may have already coerced to `true` for any
     * non-empty string, including the literal string "false") so an env var
     * explicitly set to "false"/"0"/"no" parses to `false` as intended. */
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  OVERLAY_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  OVERLAY_SANDBOX_ENABLED?: boolean = false;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  FILE_MANAGER_AVAILABLE_TABS?: string[] = [];

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return null;
    const parts = String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    return parts.length > 0 ? parts : null;
  })
  @IsString({ each: true })
  ENABLED_UI_FEATURES?: string[] | null = null;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no'].includes(String(raw).toLowerCase());
  })
  @IsBoolean()
  DEFAULT_DEPLOYMENT_PINNED?: boolean = false;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw == null) return undefined;
    if (typeof raw === 'boolean') return raw;
    /* Fail closed: this flag lets an iframe send messages as the user, so
     * only an explicit truthy value turns it on. */
    return ['true', '1', 'yes'].includes(String(raw).trim().toLowerCase());
  })
  @IsBoolean()
  ALLOW_VISUALIZER_SEND_MESSAGES?: boolean = false;

  @IsOptional()
  @IsString()
  CUSTOM_VISUALIZERS?: string;

  @IsOptional()
  @IsString()
  APPLICATION_VISUALIZERS?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return [];
    return String(value)
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  })
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  PUBLICATION_FILTER_SOURCES?: string[] = [];

  /*
   * Additional content locales authors can translate a toolset's or
   * application's Name/Description into (comma-separated BCP-47 tags).
   * No property initialiser on purpose: an absent value stays `undefined` so
   * the deprecated AVAILABLE_LOCALES fallback can apply, while a present but
   * empty value (`[]`) switches the list off and wins over the legacy one.
   */
  @IsOptional()
  @Transform(({ value }) => parseContentLocaleList(value))
  @IsArray()
  @Matches(CONTENT_LOCALE_PATTERN, { each: true })
  @MaxLength(CONTENT_LOCALE_MAX_LENGTH, { each: true })
  @IsBcp47LocaleList()
  ADDITIONAL_CONTENT_LOCALES?: string[];

  /*
   * Deprecated 0.x name for ADDITIONAL_CONTENT_LOCALES, read only when the new
   * variable is absent. Brackets and quotes are stripped the way 0.x did, so
   * `["ar","en"]` and `ar,en` are equivalent. Content locales only — 1.0 UI
   * languages and the primary locale are not configured here.
   */
  @IsOptional()
  @Transform(({ value }) =>
    parseContentLocaleList(value, { stripLegacyDecoration: true }),
  )
  @IsArray()
  @Matches(CONTENT_LOCALE_PATTERN, { each: true })
  @MaxLength(CONTENT_LOCALE_MAX_LENGTH, { each: true })
  @IsBcp47LocaleList()
  AVAILABLE_LOCALES?: string[];
}
