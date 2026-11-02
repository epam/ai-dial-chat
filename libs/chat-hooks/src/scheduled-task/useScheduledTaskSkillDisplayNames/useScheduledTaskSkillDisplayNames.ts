import { useEffect, useState } from 'react';

/** Metadata needed to display a selected skill. */
export interface ScheduledTaskSkillName {
  /** Human-readable name. */
  name: string;
}
/** Inputs for selection-scoped skill name resolution. */
export interface UseScheduledTaskSkillDisplayNamesOptions {
  /** Selected references in display order. */
  skillUrls?: readonly string[];
  /** Authoritative names from the host's current listing. */
  listed: ReadonlyMap<string, string>;
  /** Loads missing names; undefined preserves the reference as fallback. */
  getMetadata: (
    url: string,
    signal: AbortSignal,
  ) => Promise<ScheduledTaskSkillName | undefined>;
}
/** Resolves missing skill names while preserving order and authoritative listing names. */
export const useScheduledTaskSkillDisplayNames = ({
  skillUrls,
  listed,
  getMetadata,
}: UseScheduledTaskSkillDisplayNamesOptions): string[] => {
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
          try {
            const metadata = await getMetadata(url, controller.signal);
            if (!controller.signal.aborted && metadata) {
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
  }, [urlsKey, listedKey, selectionKey, getMetadata]);
  return (skillUrls ?? []).map(
    (url) =>
      listed.get(url) ||
      (resolved?.key === selectionKey ? resolved.names[url] : undefined) ||
      url,
  );
};
