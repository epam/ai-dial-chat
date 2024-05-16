export interface CustomVisualizer {
  title: string;
  description: string;
  icon: string;
  contentType: string;
  url: string;
}

export type MappedVisualizers = Record<string, CustomVisualizer[]>;

export type CustomVisualizerData = Record<string, string>;
