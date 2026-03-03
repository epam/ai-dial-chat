export interface CustomVisualizer {
  title: string;
  description: string;
  icon: string;
  contentType: string;
  url: string;
  requestTimeout?: number;
  passAuthInfo?: boolean;
}

export type MappedVisualizers = Record<string, CustomVisualizer[]>;

export interface ApplicationVisualizerConfig {
  title: string;
  description?: string;
  icon?: string;
  contentType: string;
  url: string;
  passAuthInfo?: boolean;
}

export type ApplicationVisualizers = Record<
  string,
  ApplicationVisualizerConfig
>;
