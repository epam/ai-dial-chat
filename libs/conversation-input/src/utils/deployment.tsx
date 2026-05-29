import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import type { DeploymentItemDto } from '@epam/chat-api-client';
import { IconApps, IconRobot } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { DeploymentIcon } from '../components/Input/DeploymentIcon.js';

/** Returns the human-readable label for a deployment, falling back to its id. */
export const getDeploymentLabel = (item: DeploymentItemDto): string =>
  item.displayName ?? item.id;

/**
 * Filters deployments by a case-insensitive substring match against their label.
 * An empty/whitespace query returns the list unchanged.
 */
export const filterDeployments = (
  deployments: DeploymentItemDto[],
  query: string,
): DeploymentItemDto[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return deployments;
  return deployments.filter((item) =>
    getDeploymentLabel(item).toLowerCase().includes(normalized),
  );
};

/**
 * Builds the leading icon for a deployment. Uses the resolved image URL when
 * available (with an error fallback) and a type-appropriate Tabler icon otherwise.
 */
export const buildDeploymentIcon = (
  resolvedIconUrl: string | undefined,
  type: string | undefined,
  size: number = DIAL_ICON_SIZE.SM,
): ReactNode => {
  const fallback =
    type === 'application' ? (
      <IconApps size={size} aria-hidden />
    ) : (
      <IconRobot size={size} aria-hidden />
    );
  if (resolvedIconUrl) {
    return (
      <DeploymentIcon src={resolvedIconUrl} size={size} fallback={fallback} />
    );
  }
  return fallback;
};
