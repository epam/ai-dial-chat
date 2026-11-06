import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { extractOrigin, isOriginAllowedForIframe } from '../../config/csp';
import { ApplicationVisualizerDto } from '../dto/application-visualizer.dto';
import { CustomVisualizerDto } from '../dto/custom-visualizer.dto';
import type { AdmissionLog } from './admission-log';

/**
 * Admits `CUSTOM_VISUALIZERS` fail-open: an unset or empty value resolves to
 * `undefined`; invalid JSON or a non-array
 * yields `[]`; each entry is validated independently, so one malformed
 * entry never drops the others. Unrecognized fields on an entry (e.g.
 * deferred `development`-only fields) are logged and ignored, never
 * causing the entry itself to be dropped.
 */
export const admitCustomVisualizers = (
  raw: string | undefined,
  log: AdmissionLog,
): CustomVisualizerDto[] | undefined => {
  if (!raw) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.error(
      'CUSTOM_VISUALIZERS is not valid JSON; resolving to an empty registry',
    );
    return [];
  }

  if (!Array.isArray(parsed)) {
    log.error(
      'CUSTOM_VISUALIZERS must be a JSON array; resolving to an empty registry',
    );
    return [];
  }

  const entries: CustomVisualizerDto[] = [];

  parsed.forEach((rawEntry: unknown, index: number) => {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      log.error(
        `CUSTOM_VISUALIZERS[${index}] is not an object; dropping entry`,
      );
      return;
    }

    const dto = plainToInstance(CustomVisualizerDto, rawEntry);
    const errors = validateSync(dto);
    if (errors.length > 0) {
      log.error(
        `CUSTOM_VISUALIZERS[${index}] failed validation, dropping entry: ${errors
          .map((error) => Object.values(error.constraints ?? {}).join(', '))
          .join('; ')}`,
      );
      return;
    }

    if (
      dto.contentType
        .split(',')
        .map((mime) => mime.trim())
        .filter((mime) => mime.length > 0).length === 0
    ) {
      log.error(
        `CUSTOM_VISUALIZERS[${index}] has no usable MIME type in "contentType"; dropping entry`,
      );
      return;
    }

    // `title` needs no check beyond @IsNotEmpty() above: it is an opaque
    // postMessage namespace, and a whitespace-only value is a legitimate
    // `appName` for some deployed visualizers, so it is never trimmed.
    const knownFields = new Set([
      'title',
      'description',
      'icon',
      'contentType',
      'url',
      'requestTimeout',
      'width',
      'height',
      'mobileHeight',
      'passAuthInfo',
      'passExplicitToken',
    ]);
    const unknownKeys = Object.keys(rawEntry as object).filter(
      (k) => !knownFields.has(k),
    );
    if (unknownKeys.length > 0) {
      log.warn(
        `CUSTOM_VISUALIZERS[${index}] contains unrecognized fields that will be ignored: ${unknownKeys.join(', ')}`,
      );
    }

    entries.push({
      title: dto.title,
      description: dto.description,
      icon: dto.icon,
      contentType: dto.contentType,
      url: dto.url,
      requestTimeout: dto.requestTimeout,
      width: dto.width,
      height: dto.height,
      mobileHeight: dto.mobileHeight,
      passAuthInfo: dto.passAuthInfo,
      passExplicitToken: dto.passExplicitToken,
    });
  });

  return entries;
};

/**
 * Admits `APPLICATION_VISUALIZERS` fail-open: an unset or empty value resolves
 * to `undefined`; invalid JSON or a value that
 * is not a plain object (an array included) yields `{}`; each entry is
 * validated independently, so one malformed entry never drops the others.
 * Unrecognized fields on an entry (e.g. the legacy `expanded` flag that 1.0
 * has no successor for) are logged and ignored, never causing the entry itself
 * to be dropped.
 */
export const admitApplicationVisualizers = (
  raw: string | undefined,
  allowedIframeOrigins: readonly string[],
  log: AdmissionLog,
): Record<string, ApplicationVisualizerDto> | undefined => {
  if (!raw) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    log.error(
      'APPLICATION_VISUALIZERS is not valid JSON; resolving to an empty registry',
    );
    return {};
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    log.error(
      'APPLICATION_VISUALIZERS must be a JSON object keyed by application id; resolving to an empty registry',
    );
    return {};
  }

  /* Prototype-less: an operator key of `__proto__` would otherwise mutate
   * the accumulator's prototype instead of adding an entry. */
  const entries: Record<string, ApplicationVisualizerDto> = Object.create(
    null,
  ) as Record<string, ApplicationVisualizerDto>;

  Object.entries(parsed as Record<string, unknown>).forEach(
    ([applicationId, rawEntry]) => {
      if (typeof rawEntry !== 'object' || rawEntry === null) {
        log.error(
          `APPLICATION_VISUALIZERS["${applicationId}"] is not an object; dropping entry`,
        );
        return;
      }

      const dto = plainToInstance(ApplicationVisualizerDto, rawEntry);
      const errors = validateSync(dto);
      if (errors.length > 0) {
        log.error(
          `APPLICATION_VISUALIZERS["${applicationId}"] failed validation, dropping entry: ${errors
            .map((error) => Object.values(error.constraints ?? {}).join(', '))
            .join('; ')}`,
        );
        return;
      }

      /* `contentType` is optional here, so the "no usable MIME" check only
       * applies when the field is present — an absent one legitimately
       * means "claim every attachment that carries a URL". */
      if (
        dto.contentType != null &&
        dto.contentType
          .split(',')
          .map((mime) => mime.trim())
          .filter((mime) => mime.length > 0).length === 0
      ) {
        log.error(
          `APPLICATION_VISUALIZERS["${applicationId}"] has no usable MIME type in "contentType"; dropping entry`,
        );
        return;
      }

      // `title` needs no check beyond @IsNotEmpty() above: it is an opaque
      // postMessage namespace, and a whitespace-only value is a legitimate
      // `appName` for some deployed visualizers, so it is never trimmed.
      const knownFields = new Set([
        'title',
        'description',
        'icon',
        'contentType',
        'url',
        'requestTimeout',
        'width',
        'height',
        'mobileHeight',
        'passAuthInfo',
        'passExplicitToken',
        'borderless',
        'withoutTitle',
      ]);
      const unknownKeys = Object.keys(rawEntry as object).filter(
        (k) => !knownFields.has(k),
      );
      if (unknownKeys.length > 0) {
        log.warn(
          `APPLICATION_VISUALIZERS["${applicationId}"] contains unrecognized fields that will be ignored: ${unknownKeys.join(', ')}`,
        );
      }

      if (!isOriginAllowedForIframe(dto.url, [...allowedIframeOrigins])) {
        log.warn(
          `APPLICATION_VISUALIZERS["${applicationId}"] points at ${extractOrigin(dto.url) ?? dto.url}, which is not listed in ALLOWED_IFRAME_ORIGINS; the browser will block the iframe unless that URL is same-origin with the app`,
        );
      }

      entries[applicationId] = {
        title: dto.title,
        description: dto.description,
        icon: dto.icon,
        contentType: dto.contentType,
        url: dto.url,
        requestTimeout: dto.requestTimeout,
        width: dto.width,
        height: dto.height,
        mobileHeight: dto.mobileHeight,
        passAuthInfo: dto.passAuthInfo,
        passExplicitToken: dto.passExplicitToken,
        borderless: dto.borderless,
        withoutTitle: dto.withoutTitle,
      };
    },
  );

  return entries;
};
