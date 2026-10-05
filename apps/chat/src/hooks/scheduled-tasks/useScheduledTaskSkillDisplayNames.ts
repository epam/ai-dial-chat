import { parseSkillResourceUrl } from '@epam/ai-dial-chat-hooks';
import { useEffect, useState } from 'react';
import { useSkills } from '../../context/SkillsContext';
import { getSkillMetadata } from '../../server-api/skills.api';

/** Resolves each selected name independently, preserving unavailable references. */
export const useScheduledTaskSkillDisplayNames = (skillUrls?: string[]) => {
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const listed = new Map(
    [...skills, ...(sharedWithMe ?? []), ...publicSkills].map((skill) => [
      skill.url,
      skill.name,
    ]),
  );
  const urlsKey = JSON.stringify(skillUrls ?? []);
  const listedKey = JSON.stringify(
    (skillUrls ?? []).map((url) => listed.get(url) ?? null),
  );
  const selectionKey = `${urlsKey}:${listedKey}`;
  const [resolved, setResolved] = useState<{
    key: string;
    names: Record<string, string>;
  }>();
  useEffect(() => {
    const urls: string[] = JSON.parse(urlsKey);
    const names: (string | null)[] = JSON.parse(listedKey);
    const controller = new AbortController();
    setResolved(undefined);
    const load = async () => {
      await Promise.all(
        urls.map(async (url, index) => {
          if (names[index]) return;
          const resource = parseSkillResourceUrl(url);
          if (!resource) return;
          try {
            const metadata = await getSkillMetadata(
              resource.bucket,
              resource.path,
              controller.signal,
            );
            if (!controller.signal.aborted) {
              setResolved((previous) => ({
                key: selectionKey,
                names: {
                  ...(previous?.key === selectionKey ? previous.names : {}),
                  [url]: metadata.name,
                },
              }));
            }
          } catch {
            /* Metadata failures leave the selected reference visible. */
          }
        }),
      );
    };
    void load();
    return () => controller.abort();
  }, [urlsKey, listedKey, selectionKey]);
  return (skillUrls ?? []).map(
    (url) =>
      listed.get(url) ||
      (resolved?.key === selectionKey ? resolved.names[url] : undefined) ||
      url,
  );
};
