import { AgentOrToolset } from '@/src/components/AppsEditor/Settings/form';

export interface QuickAppConfig {
  instructions: string;
  model: string;
  temperature: number;
  web_api_toolset: object;
  mcp_toolset?: object;
  document_relative_url?: string[];
  agentsOrToolsets: AgentOrToolset[];
}
