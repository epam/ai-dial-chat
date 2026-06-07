import type { DeploymentItem } from '@epam/ai-dial-chat-shared';
import { IconApps } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import FallbackEntityIcon from '../assets/fallback-entity-icon.svg?react';
import { DeploymentIcon } from '../components/Input/Icon/DeploymentIcon.js';

/** Returns the human-readable label for a deployment, falling back to its id. */
export const getDeploymentLabel = (item: DeploymentItem): string =>
  item.displayName ?? item.id;

/**
 * Filters deployments by a case-insensitive substring match against their label.
 * An empty/whitespace query returns the list unchanged.
 */
export const filterDeployments = (
  deployments: DeploymentItem[],
  query: string,
): DeploymentItem[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return deployments;
  return deployments.filter((item) =>
    getDeploymentLabel(item).toLowerCase().includes(normalized),
  );
};

/**
 * Builds the leading icon for a deployment. Uses the resolved image URL when
 * available (with an error fallback and lazy loading) and a type-appropriate
 * icon otherwise (IconApps for applications, FallbackEntityIcon for models).
 */
export const buildDeploymentIcon = (
  resolvedIconUrl: string | undefined,
  type: string | undefined,
  size = 18,
): ReactNode => {
  const fallback = (
    <FallbackEntityIcon width={size} height={size} aria-hidden />
  );

  if (resolvedIconUrl) {
    return (
      <DeploymentIcon src={resolvedIconUrl} size={size} fallback={fallback} />
    );
  }
  return fallback;
};
