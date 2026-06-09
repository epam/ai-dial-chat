import { ApiEndpoints, get } from './base';

export interface AppConfig {
  asrModelId: string | null;
  transcribeSizeLimitBytes: number;
}

export const getAppConfig = (): Promise<AppConfig> =>
  get<AppConfig>(ApiEndpoints.CONFIG);
