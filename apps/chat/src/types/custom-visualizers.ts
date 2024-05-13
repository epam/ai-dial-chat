export interface CustomVisualizer {
  Title: string;
  Description: string;
  Icon: string;
  ContentType: string;
  Url: string;
}

export type MappedVisualizers = Record<string, CustomVisualizer[]>;
