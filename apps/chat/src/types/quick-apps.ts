export interface QuickAppConfig {
  instructions: string;
  model: string;
  temperature: number;
  web_api_toolset: object;
  mcp_toolset?: object;
  document_relative_url?: string[];
}

interface FileContext {
  url: string;
  type: 'file';
}

export interface DialDeploymentToolset {
  name: 'dial-deployment-tool-set';
  type: 'dial-deployment';
  tools: {
    deployment: {
      name: string;
    };
    open_ai_tool: {
      function: {
        parameters: {
          type: 'object';
          properties: object;
        };
        name: string;
        description?: string;
      };
    };
  }[];
}

export interface MCPToolset {
  name: string;
  type: 'dial-mcp';
  dial_id: string;
  description?: string;
}

export type AnyToolset = DialDeploymentToolset | MCPToolset;

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
  return toolset.type === 'dial-deployment';
}

export function isMcpToolset(toolset: AnyToolset): toolset is MCPToolset {
  return toolset.type === 'dial-mcp';
}
