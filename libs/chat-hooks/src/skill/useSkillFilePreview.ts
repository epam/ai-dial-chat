import { useEffect, useState } from 'react';
import type { SkillFileContent } from './skill-file-preview';

/** Discriminant for the kind of error a `useSkillFilePreview` load can produce. */
export enum SkillPreviewErrorKind {
  /** HTTP 403 — the caller lacks permission to read this file. */
  Forbidden = 'forbidden',
  /** Any non-403 load failure. */
  Generic = 'generic',
}

/** Options accepted by `useSkillFilePreview`. */
export interface UseSkillFilePreviewOptions {
  /**
   * Opaque id of the selected skill file. Changing this resets all state
   * and starts a new load; stale resolutions from the previous id are discarded.
   */
  fileId: string;
  /**
   * App-owned loader; resolves with the raw file bytes when the request
   * succeeds. The hook never constructs a URL or imports a REST client.
   */
  onLoadFile: (fileId: string) => Promise<SkillFileContent>;
}

/** State returned by `useSkillFilePreview`. */
export interface UseSkillFilePreviewResult {
  /** `true` while the async load is in flight. */
  isLoading: boolean;
  /** Resolved file content, or `null` while loading or after an error. */
  content: SkillFileContent | null;
  /** Classified load error, or `null` while loading or after a success. */
  error: SkillPreviewErrorKind | null;
}

/**
 * Headless hook that manages the skill-file preview loading lifecycle.
 * Starts a new load on mount and whenever `fileId` changes; classifies errors
 * as `Forbidden` (HTTP 403) or `Generic`; discards settlements from superseded
 * or unmounted loads.
 */
export const useSkillFilePreview = ({
  fileId,
  onLoadFile,
}: UseSkillFilePreviewOptions): UseSkillFilePreviewResult => {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<SkillFileContent | null>(null);
  const [error, setError] = useState<SkillPreviewErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setContent(null);
    setError(null);

    const load = async () => {
      try {
        const result = await onLoadFile(fileId);
        if (cancelled) return;
        setContent(result);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        const status = (err as { status?: number }).status;
        setError(
          status === 403
            ? SkillPreviewErrorKind.Forbidden
            : SkillPreviewErrorKind.Generic,
        );
        setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [fileId, onLoadFile]);

  return { isLoading, content, error };
};
