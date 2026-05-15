export const SIDEBAR_MIN_WIDTH = 260;
export const MOBILE_SIDEBAR_MIN_WIDTH = 312;
export const HEADER_HEIGHT = 48;
export const DEFAULT_HEADER_ICON_SIZE = 24;
export const OVERLAY_HEADER_ICON_SIZE = 18;
export const DEFAULT_CONVERSATION_NAME = 'New conversation';
export const DEFAULT_PROMPT_NAME = 'Prompt';
export const DEFAULT_FOLDER_NAME = 'New folder';
export const DEFAULT_APPLICATION_NAME = 'Untitled app';
export const DEFAULT_TOOLSET_NAME = 'Untitled toolset';
export const EMPTY_MODEL_ID = 'empty';

export const FALLBACK_MODEL_ID = 'gpt-35-turbo';

export const MIN_ENTITY_LENGTH = 1;
export const MAX_ENTITY_NAME_NUMERATION = 1999;

// Byte limits for resource ids/segments in the configured storage backend.
// RESOURCE_MAX_ID_BYTES is fixed at 1024 (S3/GCS/Azure standard) and cannot
// be overridden at runtime.
// RESOURCE_MAX_SEGMENT_BYTES can be tuned via env var (e.g. MinIO uses 255)
// but must be strictly less than RESOURCE_MAX_ID_BYTES.
export const RESOURCE_MAX_ID_BYTES = 1024;

const DEFAULT_RESOURCE_MAX_SEGMENT_BYTES = 255;

const parsePositiveInteger = (
  value: string | undefined,
): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsedValue = parseInt(value, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : undefined;
};

export const RESOURCE_MAX_SEGMENT_BYTES = (() => {
  const configured = parsePositiveInteger(
    process.env.NEXT_PUBLIC_RESOURCE_MAX_SEGMENT_BYTES,
  );
  if (configured !== undefined && configured < RESOURCE_MAX_ID_BYTES) {
    return configured;
  }
  return DEFAULT_RESOURCE_MAX_SEGMENT_BYTES;
})();

export const FALLBACK_TEMPERATURE = 1;

export const DEFAULT_TEMPERATURE = process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE
  ? parseFloat(process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE)
  : FALLBACK_TEMPERATURE;
