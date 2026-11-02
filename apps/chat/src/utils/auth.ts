import type { ProviderInfoDto } from '@epam/ai-dial-chat-api-client';
import type { LoginScreenProvider } from '@epam/ai-dial-ui-kit';
import { getProviderIconUrl } from '../components/ProviderIcon/ProviderIcon';

export const toLoginScreenProviders = (
  providers: ProviderInfoDto[],
  callbackUrl: string,
): LoginScreenProvider[] =>
  providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    href: `/api/v1/auth/login/${encodeURIComponent(provider.id)}?callbackUrl=${encodeURIComponent(callbackUrl)}`,
    iconSrc: getProviderIconUrl(provider.id),
  }));
