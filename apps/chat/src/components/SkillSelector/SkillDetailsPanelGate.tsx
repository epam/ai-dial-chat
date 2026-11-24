import type { SkillDetailsPanelComponentProps } from '@epam/ai-dial-skills';
import { lazy, memo, type FC } from 'react';
import { useDeferredOverlayMount } from '../../hooks/useDeferredOverlayMount';

const SkillDetailsPanelContainer = lazy(async () => {
  const module = await import('./SkillDetailsPanelContainer');
  return { default: module.default };
});

/**
 * The skill selector renders its details panel at all times, with `skillId`
 * `null` while closed. Mounted that early, the panel's `lazy()` boundary
 * fetched its chunk — and the markdown engine, catalog and canvas code it
 * depends on — during the home page's first paint. It now mounts, still
 * closed, after the page has loaded, or when a skill's details open first.
 * The skill selector supplies the `Suspense` boundary.
 */
const SkillDetailsPanelGate: FC<SkillDetailsPanelComponentProps> = ({
  skillId,
  onClose,
}) => {
  const isMounted = useDeferredOverlayMount(skillId != null);
  if (!isMounted) return null;
  return <SkillDetailsPanelContainer skillId={skillId} onClose={onClose} />;
};

export default memo(SkillDetailsPanelGate);
