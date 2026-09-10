import { DetailsPanel } from '@epam/ai-dial-catalog';
import type { FC } from 'react';
import type { SkillDetailsSidePanelProps } from '../../models/skill-details-side-panel-props';

/**
 * Right-anchored side panel showing one skill's details, composed from
 * `@epam/ai-dial-catalog`'s `DetailsPanel` — the skills-scoped composition
 * point for hosts that surface skill details outside the Catalog page,
 * without its page chrome.
 */
export const SkillDetailsSidePanel: FC<SkillDetailsSidePanelProps> = (
  props,
) => <DetailsPanel {...props} />;
