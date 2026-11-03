import {
  getApiErrorStatus,
  parseSkillResourceUrl,
} from '@epam/ai-dial-chat-hooks';
import { useEffect, useState } from 'react';
import { useSkills } from '../../context/SkillsContext';
import { getSkillMetadata } from '../../server-api/skills.api';

/** Resolved metadata and availability of a saved reference. */
export interface ScheduledTaskSkillDetails {
  url: string;
  name: string;
  isUnavailable: boolean;
  isLoading: boolean;
}

/** Resolves missing metadata once; temporary failures do not imply deletion. */
export const useScheduledTaskSkillDetails = (
  skillUrls?: string[],
): ScheduledTaskSkillDetails[] => {
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
  const key = urlsKey + ':' + listedKey;
  const [result, setResult] = useState<{
    key: string;
    entries: Record<string, ScheduledTaskSkillDetails>;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    setResult(undefined);
    const urls: string[] = JSON.parse(urlsKey);
    const names: (string | null)[] = JSON.parse(listedKey);
    const load = async (url: string, index: number) => {
      if (names[index]) return;
      const resource = parseSkillResourceUrl(url);
      if (!resource) return;
      let entry: ScheduledTaskSkillDetails;
      try {
        const metadata = await getSkillMetadata(
          resource.bucket,
          resource.path,
          controller.signal,
        );
        entry = {
          url,
          name: metadata.name,
          isUnavailable: false,
          isLoading: false,
        };
      } catch (error) {
        const status = getApiErrorStatus(error);
        entry = {
          url,
          name: url,
          isUnavailable: status === 400 || status === 403 || status === 404,
          isLoading: false,
        };
      }
      if (!controller.signal.aborted) {
        setResult((previous) => ({
          key,
          entries: {
            ...(previous?.key === key ? previous.entries : {}),
            [url]: entry,
          },
        }));
      }
    };
    urls.forEach((url, index) => {
      void load(url, index);
    });
    return () => controller.abort();
  }, [key, urlsKey, listedKey]);
  return (skillUrls ?? []).map((url) => ({
    url,
    name: listed.get(url) || url,
    isUnavailable: false,
    isLoading: !listed.has(url) && Boolean(parseSkillResourceUrl(url)),
    ...(!listed.get(url) && result?.key === key
      ? result.entries[url]
      : undefined),
  }));
};

/** Unavailable references resolved with the same metadata used by previews. */
export const useUnavailableScheduledTaskSkills = (skillUrls?: string[]) =>
  useScheduledTaskSkillDetails(skillUrls)
    .filter((skill) => skill.isUnavailable)
    .map((skill) => skill.url);
