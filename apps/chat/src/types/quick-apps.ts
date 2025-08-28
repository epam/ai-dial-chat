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

interface DialDeploymentToolset {
  name: 'dial-deployment-tool-set';
  type: 'dial-deployment';
  tools: [
    {
      deployment: {
        name: string;
      };
      open_ai_tool: {
        function: {
          parameters: {
            type: 'object';
            properties: object;
          };
          description: string;
          name: string;
        };
      };
    },
  ];
}

interface MCPToolset {
  name: string;
  type: 'dial-mcp';
  dial_id: string;
  description: string;
}

type ToolSet = DialDeploymentToolset | MCPToolset;

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
  tool_sets: ToolSet[];
}

export function isDialDeploymentToolset(
  toolset: ToolSet,
): toolset is DialDeploymentToolset {
  return toolset.type === 'dial-deployment';
}

export function isMcpToolset(toolset: ToolSet): toolset is MCPToolset {
  return toolset.type === 'dial-mcp';
}
