import { logger } from '@/src/utils/server/logger';

import { EntityType } from '@/src/types/common';

import { FALLBACK_MODEL_ID } from './default-ui-settings';

export const DIAL_API_HOST = process.env.DIAL_API_HOST;

export const DIAL_API_VERSION =
  process.env.DIAL_API_VERSION || '2025-01-01-preview';

interface DefaultModel {
  entityReference: string;
  entityType: EntityType.Model | EntityType.Application;
}

const FALLBACK_DEFAULT_MODEL: DefaultModel = {
  entityReference: FALLBACK_MODEL_ID,
  entityType: EntityType.Model,
};

export function parseDefaultModel(raw: string | undefined): DefaultModel {
  if (!raw) return FALLBACK_DEFAULT_MODEL;

  const trimmed = raw.trim();

  if (!trimmed.startsWith('{')) {
    return { entityReference: trimmed, entityType: EntityType.Application };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const msg = `[DEFAULT_MODEL] Failed to parse JSON: "${raw}". Falling back to default.`;
    console.error(msg);
    logger.error(msg);
    return FALLBACK_DEFAULT_MODEL;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    const msg = `[DEFAULT_MODEL] Parsed value is not an object. Falling back to default.`;
    console.error(msg);
    logger.error(msg);
    return FALLBACK_DEFAULT_MODEL;
  }

  const { entityReference, entityType } = parsed as Record<string, unknown>;

  if (typeof entityReference !== 'string' || !entityReference) {
    const msg = `[DEFAULT_MODEL] Missing or invalid "entityReference". Falling back to default.`;
    console.error(msg);
    logger.error(msg);
    return FALLBACK_DEFAULT_MODEL;
  }

  const normalizedType =
    typeof entityType === 'string' ? entityType.toLowerCase() : '';
  const validTypes: string[] = [EntityType.Model, EntityType.Application];

  if (!validTypes.includes(normalizedType)) {
    const msg = `[DEFAULT_MODEL] Unknown entityType "${entityType}". Falling back to default.`;
    console.error(msg);
    logger.error(msg);
    return FALLBACK_DEFAULT_MODEL;
  }

  return {
    entityReference,
    entityType: normalizedType as EntityType.Model | EntityType.Application,
  };
}

export const DEFAULT_MODEL = parseDefaultModel(process.env.DEFAULT_MODEL);

export const DEFAULT_MODEL_ID = DEFAULT_MODEL.entityReference;

export const MAX_PROMPT_TOKENS_DEFAULT_PERCENT = process.env
  .MAX_PROMPT_TOKENS_DEFAULT_PERCENT
  ? parseInt(process.env.MAX_PROMPT_TOKENS_DEFAULT_PERCENT, 10)
  : 75;

export const MAX_PROMPT_TOKENS_DEFAULT_VALUE = process.env
  .MAX_PROMPT_TOKENS_DEFAULT_VALUE
  ? parseInt(process.env.MAX_PROMPT_TOKENS_DEFAULT_VALUE, 10)
  : 2000;

export const DEFAULT_SYSTEM_PROMPT =
  process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT ?? '';
