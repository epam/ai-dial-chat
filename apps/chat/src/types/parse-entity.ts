export interface ParseEntityApiKeyOptions {
  parseModel?: boolean;
  parseVersion?: boolean;
  defaultVersion?: string;
}

interface ModelInfo {
  model: { id: string };
  isPlayback: boolean;
  isReplay: boolean;
}

// version will be string if parseVersion is true, modelInfo will be ModelInfo if parseModel is true
export type ParseEntityApiKeyResult<T extends ParseEntityApiKeyOptions> = {
  name: string;
  uuid?: string;
} & (T extends { parseModel: true }
  ? {
      modelInfo: ModelInfo;
    }
  : { modelInfo?: ModelInfo }) &
  (T extends { parseVersion: true }
    ? { version: string }
    : { version?: string });
