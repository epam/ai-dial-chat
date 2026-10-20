import {
  parseSkillResourceUrl,
  safeDecodeURIComponent,
} from '@epam/ai-dial-chat-hooks';
import { getSkillFallbackName } from '@epam/ai-dial-skills';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduledTasksI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useSkills } from '../../context/SkillsContext';
import { getSkillMetadata } from '../../server-api/skills.api';

interface ResolvedSkillNames {
  key: string;
  names: Record<string, string>;
  failed: Record<string, true>;
}

/** Display text for each selected skill, plus the references known to be unavailable. */
export interface ScheduledTaskSkillDisplay {
  /** One display name per selected reference, in selection order. */
  names: string[];
  /** Selected references that are deleted, unreadable, or not skill URLs. */
  unavailableUrls: string[];
  /** Positions in `names` of the unavailable references. */
  unavailableIndexes: number[];
}

/**
 * Resolves each selected name independently. A reference that cannot be
 * resolved — deleted, unreadable, or not a skill URL — renders as its last
 * path segment marked unavailable, never as the raw resource path.
 */
export const useScheduledTaskSkillDisplayNames = (
  skillUrls?: string[],
): ScheduledTaskSkillDisplay => {
  const { t } = useTranslation();
  const { user } = useUser();
  const { skills, sharedWithMe, publicSkills, isEnabled, isLoading, error } =
    useSkills();
  const listed = new Map(
    [...skills, ...(sharedWithMe ?? []), ...publicSkills].map((skill) => [
      skill.url,
      skill.name,
    ]),
  );
  /*
   * A settled, successful listing is authoritative for the viewer's own
   * bucket: an own-bucket reference missing from it was deleted, so asking
   * DIAL Core for its metadata would only produce a failed request.
   */
  const viewerBucket = user?.bucket;
  const isOwnListingAuthoritative = isEnabled && !isLoading && error == null;
  const isKnownDeleted = (url: string) => {
    if (!isOwnListingAuthoritative || viewerBucket == null) return false;
    if (listed.has(url)) return false;
    const bucket = parseSkillResourceUrl(url)?.bucket;
    return (
      bucket != null &&
      safeDecodeURIComponent(bucket) === safeDecodeURIComponent(viewerBucket)
    );
  };
  const lookupUrls = isLoading
    ? []
    : (skillUrls ?? []).filter(
        (url) =>
          !listed.has(url) &&
          !isKnownDeleted(url) &&
          parseSkillResourceUrl(url) != null,
      );
  const lookupKey = JSON.stringify(lookupUrls);
  const [resolved, setResolved] = useState<ResolvedSkillNames>();
  useEffect(() => {
    const urls: string[] = JSON.parse(lookupKey);
    const controller = new AbortController();
    const settle = (url: string, name?: string) => {
      if (controller.signal.aborted) return;
      setResolved((previous) => {
        const current =
          previous?.key === lookupKey
            ? previous
            : { key: lookupKey, names: {}, failed: {} };
        return name == null
          ? { ...current, failed: { ...current.failed, [url]: true } }
          : { ...current, names: { ...current.names, [url]: name } };
      });
    };
    setResolved(undefined);
    const load = async () => {
      await Promise.all(
        urls.map(async (url) => {
          const resource = parseSkillResourceUrl(url);
          if (!resource) return;
          try {
            const metadata = await getSkillMetadata(
              resource.bucket,
              resource.path,
              controller.signal,
            );
            settle(url, metadata.name);
          } catch {
            settle(url);
          }
        }),
      );
    };
    void load();
    return () => controller.abort();
  }, [lookupKey]);
  const current = resolved?.key === lookupKey ? resolved : undefined;
  const isUnavailable = (url: string) =>
    !listed.get(url) &&
    !current?.names[url] &&
    (isKnownDeleted(url) ||
      Boolean(current?.failed[url]) ||
      (!isLoading && parseSkillResourceUrl(url) == null));
  const urls = skillUrls ?? [];
  const names = urls.map((url) => {
    const name = listed.get(url) || current?.names[url];
    if (name) return name;
    const fallbackName = safeDecodeURIComponent(getSkillFallbackName(url));
    return isUnavailable(url)
      ? t(ScheduledTasksI18nKeys.CreateSkillUnavailableLabel, {
          name: fallbackName,
        })
      : fallbackName;
  });
  return {
    names,
    unavailableUrls: urls.filter(isUnavailable),
    unavailableIndexes: urls.flatMap((url, index) =>
      isUnavailable(url) ? [index] : [],
    ),
  };
};
