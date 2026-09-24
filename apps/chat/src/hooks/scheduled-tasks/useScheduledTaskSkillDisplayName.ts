import { parseSkillResourceUrl } from '@epam/ai-dial-chat-hooks';
import { useEffect, useState } from 'react';
import { useSkills } from '../../context/SkillsContext';
import { getSkillMetadata } from '../../server-api/skills.api';

/** Resolves display metadata without making a saved reference depend on availability. */
export const useScheduledTaskSkillDisplayName = (skillUrl?: string) => {
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const listed = [...skills, ...(sharedWithMe ?? []), ...publicSkills].find(
    (skill) => skill.url === skillUrl,
  )?.name;
  const [resolved, setResolved] = useState<{ url: string; name: string }>();
  useEffect(() => {
    if (!skillUrl || listed) return;
    const resource = parseSkillResourceUrl(skillUrl);
    if (!resource) return;
    setResolved(undefined);
    const controller = new AbortController();
    void getSkillMetadata(resource.bucket, resource.path, controller.signal)
      .then((metadata) => {
        if (!controller.signal.aborted)
          setResolved({ url: skillUrl, name: metadata.name });
      })
      .catch(() => {
        /* Read-only metadata failures retain the saved reference. */
        if (!controller.signal.aborted) setResolved(undefined);
      });
    return () => controller.abort();
  }, [skillUrl, listed]);
  return skillUrl
    ? listed ||
        (resolved?.url === skillUrl ? resolved.name : undefined) ||
        skillUrl
    : undefined;
};
