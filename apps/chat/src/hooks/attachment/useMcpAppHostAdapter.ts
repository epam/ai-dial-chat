import { useMcpAppHostAdapter as useMcpAppHostAdapterBase } from '@epam/ai-dial-chat-hooks/mcp-apps';
import type { McpAppHostAdapter } from '@epam/ai-dial-mcp-apps';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../context/AppConfigContext';
import { useTheme } from '../../context/ThemeContext';
import { mcpAppsApiClient } from '../../server-api/mcp-apps';
import { UserConfigStatus } from '../../types/user-config-status';

/**
 * App-level adapter wiring `@epam/ai-dial-chat-hooks/mcp-apps`'s host-agnostic
 * `useMcpAppHostAdapter` to this app's config/theme/i18n context and the
 * configured `mcpAppsApiClient` — the only piece of this glue that can't live
 * in a lib, since a lib must never read app context directly.
 */
export const useMcpAppHostAdapter = (
  displayMode: 'inline' | 'fullscreen',
): McpAppHostAdapter => {
  const { status, config } = useAppConfig();
  const { currentTheme } = useTheme();
  const { i18n } = useTranslation();
  const sandboxUrl =
    status === UserConfigStatus.Ready ? config.mcpAppSandboxUrl : null;

  return useMcpAppHostAdapterBase(displayMode, mcpAppsApiClient, sandboxUrl, {
    theme: currentTheme,
    mcpAppTheme: config.mcpAppTheme,
    locale: i18n.language,
    mcpAppUserAgent: config.mcpAppUserAgent,
  });
};
