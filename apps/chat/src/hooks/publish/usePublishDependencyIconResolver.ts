import { createPublishDependencyIconResolver } from '@epam/ai-dial-chat-hooks';
import { useMemo } from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import { resolveCatalogIconUrl } from '../../utils/icon-path';

/**
 * Returns the lookup that gives a publish dependency the icon of the
 * application or toolset it names, read from the deployments and toolsets the
 * catalog has already loaded. It makes no request: an entity the user cannot
 * see in the catalog simply has no icon and shows its initials.
 */
export const usePublishDependencyIconResolver = () => {
  const { items: deployments, toolsets } = useDeployments();

  return useMemo(
    () =>
      createPublishDependencyIconResolver({
        deployments,
        toolsets,
        resolveIconUrl: resolveCatalogIconUrl,
      }),
    [deployments, toolsets],
  );
};
