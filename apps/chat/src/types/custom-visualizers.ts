export interface CustomVisualizer {
  title: string;
  description: string;
  icon: string;
  contentType: string;
  url: string;

  hideTitle?: boolean;
  expandedByDefault?: boolean;
  borderless?: boolean;
}

export type MappedVisualizers = Record<string, CustomVisualizer[]>;
