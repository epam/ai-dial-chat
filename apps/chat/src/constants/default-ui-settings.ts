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

export const RESOURCE_MAX_ID_BYTES = 1024;
export const DEFAULT_RESOURCE_MAX_SEGMENT_BYTES = 255;

export const resolveResourceMaxSegmentBytes = (
  value: string | undefined,
): number => {
  if (!value) {
    return DEFAULT_RESOURCE_MAX_SEGMENT_BYTES;
  }

  const parsedValue = parseInt(value, 10);
  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0 ||
    parsedValue >= RESOURCE_MAX_ID_BYTES
  ) {
    return DEFAULT_RESOURCE_MAX_SEGMENT_BYTES;
  }

  return parsedValue;
};

export const FALLBACK_TEMPERATURE = 1;

export const DEFAULT_TEMPERATURE = process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE
  ? parseFloat(process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE)
  : FALLBACK_TEMPERATURE;
