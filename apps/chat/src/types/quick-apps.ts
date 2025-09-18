import {
  DialDeploymentToolsetToolTypes,
  ToolsetTypes,
} from '@/src/constants/quick-apps';

import { ToolsetTransportType } from '@epam/ai-dial-shared';

export interface QuickAppConfig {
  instructions: string;
  model: string;
  temperature: number;
  web_api_toolset: object;
  mcp_toolset?: object;
  document_relative_url?: string[];
}

export interface FileContext {
  url: string;
  type: 'file';
}

export interface DialDeploymentSimpleTool {
  type: DialDeploymentToolsetToolTypes.DialDeploymentSimple;
  deployment_id: string;
}

export interface DialDeploymentToolset {
  name: 'dial-deployment-tool-set';
  type: ToolsetTypes.DialDeployment;
  tools: DialDeploymentSimpleTool[];
}

export interface MCPToolset {
  name: string;
  type: ToolsetTypes.DialMcp;
  dial_id: string;
  transport: ToolsetTransportType;
  description?: string;
}

export interface CodeInterpreterToolset {
  template_name: 'py_interpreter';
  type: ToolsetTypes.CodeInterpreter;
}

export type AnyToolset =
  | DialDeploymentToolset
  | MCPToolset
  | CodeInterpreterToolset;

export interface QuickApp2Config {
  orchestrator: {
    deployment: {
      name: string;
      parameters: {
        temperature: number;
      };
    };
    system_prompt: {
      type: 'custom';
      variables: object;
      content: string;
    };
  };
  contexts: FileContext[];
  tool_sets: AnyToolset[];
}

export function isDialDeploymentToolset(
  toolset: AnyToolset,
): toolset is DialDeploymentToolset {
  return toolset.type === ToolsetTypes.DialDeployment;
}

export function isMcpToolset(toolset: AnyToolset): toolset is MCPToolset {
  return toolset.type === ToolsetTypes.DialMcp;
}

export function isCodeInterpreterToolset(
  toolset: AnyToolset,
): toolset is CodeInterpreterToolset {
  return toolset.type === ToolsetTypes.CodeInterpreter;
}
