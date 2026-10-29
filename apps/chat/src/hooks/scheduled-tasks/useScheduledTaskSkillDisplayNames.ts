import { parseSkillResourceUrl } from '@epam/ai-dial-chat-hooks';
import { useScheduledTaskSkillDisplayNames as useDisplayNames } from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { useSkills } from '../../context/SkillsContext';
import { getSkillMetadata } from '../../server-api/skills.api';

const getMetadata = async (url: string, signal: AbortSignal) => {
  const resource = parseSkillResourceUrl(url);
  return resource
    ? getSkillMetadata(resource.bucket, resource.path, signal)
    : undefined;
};
/** Resolves selected names using the current host catalog and configured metadata API. */
export const useScheduledTaskSkillDisplayNames = (skillUrls?: string[]) => {
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const listed = new Map(
    [...skills, ...(sharedWithMe ?? []), ...publicSkills].map((skill) => [
      skill.url,
      skill.name,
    ]),
  );
  return useDisplayNames({ skillUrls, listed, getMetadata });
};
