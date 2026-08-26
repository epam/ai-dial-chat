import { useAppConfig } from '../../context/AppConfigContext';
import { UserConfigStatus } from '../../types/user-config-status';

/** Returns the operator-configured MCP Apps sandbox-proxy URL, or `null` while loading, on error, or when unconfigured. */
export const useMcpAppSandboxUrl = (): string | null => {
  const { status, config } = useAppConfig();
  return status === UserConfigStatus.Ready ? config.mcpAppSandboxUrl : null;
};
