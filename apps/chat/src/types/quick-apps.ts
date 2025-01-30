export interface QuickAppConfig {
  instructions: string;
  model: string;
  temperature: number;
  web_api_toolset: object;
  document_relative_url?: string;
}
