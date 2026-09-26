import type { Agent as HttpAgent } from 'http';
import { Logger } from '@nestjs/common';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { custom, Issuer } from 'openid-client';
import { getProxyForUrl } from 'proxy-from-env';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

const logger = new Logger('ProxyAgentSetup');

const readProxyEnvValue = (
  name: 'HTTP_PROXY' | 'HTTPS_PROXY',
): string | undefined => process.env[name] || process.env[name.toLowerCase()];

const maskProxyCredentials = (proxyUrl: string): string => {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return proxyUrl;
  }
};

const agentsByProxyUrl = new Map<string, HttpAgent>();

/*
 * `getProxyForUrl` (from `proxy-from-env`) always reads the real `process.env` itself — it
 * has no way to take an injected environment — so this NO_PROXY-aware selection is only ever
 * consistent with the real runtime environment, not a value passed by a caller.
 */
const getProxyAgentForUrl = (url: URL): HttpAgent | undefined => {
  const proxyUrl = getProxyForUrl(url.href);
  if (!proxyUrl) {
    return undefined;
  }
  let agent = agentsByProxyUrl.get(proxyUrl);
  if (!agent) {
    agent = new HttpsProxyAgent(proxyUrl);
    agentsByProxyUrl.set(proxyUrl, agent);
  }
  return agent;
};

/*
 * Installs corporate-proxy support for every outbound HTTP(S) call this app makes to the
 * internet: native `fetch` (theme service, DIAL Core client) goes through a global undici
 * dispatcher, while `openid-client`'s OIDC discovery/token/JWKS requests bypass undici
 * entirely and use Node's raw `http`/`https`, so they're routed via its `custom.http_options`
 * hook instead. Both honor the standard `HTTP_PROXY`/`HTTPS_PROXY`/`NO_PROXY` variables. Must
 * run before `NestFactory.create(AppModule)` resolves, since `ProviderRegistryService`'s
 * `onModuleInit()` performs OIDC discovery during that call.
 */
export const configureProxyAgents = (): void => {
  const httpProxy = readProxyEnvValue('HTTP_PROXY');
  const httpsProxy = readProxyEnvValue('HTTPS_PROXY');
  const configuredProxy = httpsProxy ?? httpProxy;
  if (!configuredProxy) {
    return;
  }

  logger.log(
    `Outbound HTTP(S) requests will use corporate proxy ${maskProxyCredentials(configuredProxy)}`,
  );

  setGlobalDispatcher(new EnvHttpProxyAgent());

  Issuer[custom.http_options] = (url, options) => {
    const agent = getProxyAgentForUrl(url);
    return agent ? { ...options, agent } : options;
  };
};
