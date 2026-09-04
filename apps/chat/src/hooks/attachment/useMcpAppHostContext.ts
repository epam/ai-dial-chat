import type { McpUiHostContext } from '@mcp-ui/client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../context/AppConfigContext';
import { useTheme } from '../../context/ThemeContext';

/* All CSS variable names defined by the MCP UI standard (McpUiStyleVariableKey union). */
const MCP_UI_CSS_VAR_KEYS = [
  '--color-background-primary',
  '--color-background-secondary',
  '--color-background-tertiary',
  '--color-background-inverse',
  '--color-background-ghost',
  '--color-background-info',
  '--color-background-danger',
  '--color-background-success',
  '--color-background-warning',
  '--color-background-disabled',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-text-inverse',
  '--color-text-ghost',
  '--color-text-info',
  '--color-text-danger',
  '--color-text-success',
  '--color-text-warning',
  '--color-text-disabled',
  '--color-border-primary',
  '--color-border-secondary',
  '--color-border-tertiary',
  '--color-border-inverse',
  '--color-border-ghost',
  '--color-border-info',
  '--color-border-danger',
  '--color-border-success',
  '--color-border-warning',
  '--color-border-disabled',
  '--color-ring-primary',
  '--color-ring-secondary',
  '--color-ring-inverse',
  '--color-ring-info',
  '--color-ring-danger',
  '--color-ring-success',
  '--color-ring-warning',
  '--font-sans',
  '--font-mono',
  '--font-weight-normal',
  '--font-weight-medium',
  '--font-weight-semibold',
  '--font-weight-bold',
  '--font-text-xs-size',
  '--font-text-sm-size',
  '--font-text-md-size',
  '--font-text-lg-size',
  '--font-heading-xs-size',
  '--font-heading-sm-size',
  '--font-heading-md-size',
  '--font-heading-lg-size',
  '--font-heading-xl-size',
  '--font-heading-2xl-size',
  '--font-heading-3xl-size',
  '--font-text-xs-line-height',
  '--font-text-sm-line-height',
  '--font-text-md-line-height',
  '--font-text-lg-line-height',
  '--font-heading-xs-line-height',
  '--font-heading-sm-line-height',
  '--font-heading-md-line-height',
  '--font-heading-lg-line-height',
  '--font-heading-xl-line-height',
  '--font-heading-2xl-line-height',
  '--font-heading-3xl-line-height',
  '--border-radius-xs',
  '--border-radius-sm',
  '--border-radius-md',
  '--border-radius-lg',
  '--border-radius-xl',
  '--border-radius-full',
  '--border-width-regular',
  '--shadow-hairline',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
] as const;

type McpStyleVariables = NonNullable<
  NonNullable<McpUiHostContext['styles']>['variables']
>;

const readMcpStyleVariables = (): McpStyleVariables => {
  const computed = getComputedStyle(document.documentElement);
  const vars: Record<string, string | undefined> = {};
  for (const key of MCP_UI_CSS_VAR_KEYS) {
    const value = computed.getPropertyValue(key).trim();
    if (value) vars[key] = value;
  }
  return vars as McpStyleVariables;
};

/**
 * Builds the `McpUiHostContext` delivered to a mounted MCP App during its
 * `ui/initialize` handshake, shared by every place that mounts an app —
 * the full-width attachment canvas (`displayMode: 'fullscreen'`) and the
 * compact inline preview under a message (`displayMode: 'inline'`) — so the
 * app can size/style itself differently for each.
 */
export const useMcpAppHostContext = (
  displayMode: 'inline' | 'fullscreen',
): McpUiHostContext => {
  const { i18n } = useTranslation();
  const { currentTheme } = useTheme();
  const { config } = useAppConfig();
  const mcpAppTheme = config.mcpAppTheme;
  const mcpAppUserAgent = config.mcpAppUserAgent;

  return useMemo(
    () => ({
      theme: (mcpAppTheme ?? currentTheme) as 'light' | 'dark',
      locale: i18n.language,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: mcpAppUserAgent ?? 'ai-dial-chat',
      platform: 'web',
      displayMode,
      styles: { variables: readMcpStyleVariables() },
    }),
    [mcpAppTheme, currentTheme, i18n.language, mcpAppUserAgent, displayMode],
  );
};
