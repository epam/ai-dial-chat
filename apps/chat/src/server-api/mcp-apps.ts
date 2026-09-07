import { createMcpAppsApiClient } from '@epam/ai-dial-chat-hooks/mcp-apps';
import { toolsetsApi } from './api-client';

/** Configured `McpAppsApiClient` (chat-api's `ToolsetsApi`) shared by every MCP Apps hook this app uses. */
export const mcpAppsApiClient = createMcpAppsApiClient(toolsetsApi);
