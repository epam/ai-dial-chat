import { type DeploymentItem, DeploymentIcon } from '@epam/ai-dial-chat-shared';
import { DialTooltip } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';
import FallbackEntityIcon from '../assets/fallback-entity-icon.svg?react';

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
  tooltip?: string,
): ReactNode => {
  if (resolvedIconUrl) {
    return (
      <DeploymentIcon src={resolvedIconUrl} size={size} tooltip={tooltip} />
    );
  }
  if (tooltip) {
    return (
      <DialTooltip tooltip={tooltip} triggerClassName="flex shrink-0">
        <FallbackEntityIcon width={size} height={size} aria-hidden />
      </DialTooltip>
    );
  }
  return <FallbackEntityIcon width={size} height={size} aria-hidden />;
};
