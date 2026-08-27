import type { SkillUploadResponseDto } from '@epam/ai-dial-chat-api-client';
import type {
  SkillEditorErrors,
  SkillEditorValues,
  SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useRef, useState } from 'react';
import { getApiErrorDetails, getApiErrorStatus } from '../api-error/api-error';
import {
  buildSkillFilesPayload,
  buildSkillManifestForSubmit,
  isValidSkillRelativePath,
  normalizeSkillName,
} from './skill';
import type { SkillFileContent } from './skill-file-preview';

/*
 * Phase names collapse the tasks.md-specified `initial`/`dirty` distinction
 * into a single `idle` phase for submit purposes — dirty tracking for
 * navigation guards is handled separately (via the library's
 * `onDirtyChange`), not folded into this enum.
 */
type SubmitPhase = 'idle' | 'submitting' | 'success' | 'failure';

/*
 * Fingerprints the in-memory package (form values + supporting-file paths) so
 * a retried submission after a 503 resubmits the exact same request payload
 * rather than re-deriving it from (possibly since-edited) current form state.
 */
const fingerprintAttempt = (
  values: SkillEditorValues,
  files: SkillFileTreeNode[],
): string =>
  JSON.stringify({
    values,
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
  });

interface LastAttempt {
  fingerprint: string;
  bucket: string;
  path: string;
  skillManifest: string;
  filePaths: string[];
  files: Blob[];
}

/** Already-configured DIAL Core write operations `useSkillEditorSubmit` needs. */
export interface SkillEditorSubmitClient {
  /** Creates a new skill. */
  createSkill: (
    bucket: string,
    path: string,
    skillManifest: string,
    filePaths: string[],
    files: Blob[],
  ) => Promise<SkillUploadResponseDto>;
  /** Updates an existing skill, sending `ifMatch` as the concurrency guard. */
  updateSkill: (
    bucket: string,
    path: string,
    skillManifest: string,
    filePaths: string[],
    files: Blob[],
    ifMatch: string,
  ) => Promise<SkillUploadResponseDto>;
}

/** Localized messages `useSkillEditorSubmit` needs. */
export interface SkillEditorSubmitMessages {
  /** Shown when a required field is empty. */
  required: string;
  /** Shown when the normalized skill name fails DIAL's naming rules. */
  nameInvalid: string;
  /** Shown when the skill name already exists (409), or defensively on an unreachable create-mode 412. */
  nameConflict: string;
  /** Shown when the submitted package exceeds the server's size limit (413). */
  archiveTooLarge: string;
  /** Shown when the backend is temporarily unavailable (503). */
  serviceUnavailable: string;
  /** Fallback shown for a 400 whose response body carries no message. */
  pathInvalid: string;
  /** Generic fallback shown for any other error status. */
  saveError: string;
  /** Notification title on a successful create. */
  saveSuccessTitle: string;
  /** Notification message on a successful create, given the created name. */
  createSuccess: (name: string) => string;
  /** Notification title on a successful update. */
  updateSuccessTitle: string;
  /** Notification message on a successful update, given the skill's name. */
  updateSuccess: (name: string) => string;
  /** Shown when a save hits a stale-ETag conflict (412) in edit mode. */
  conflictMessage: string;
}

/** A host notification `useSkillEditorSubmit` asks to be shown. */
export interface SkillEditorSubmitNotification {
  /** Notification style. */
  variant: NotificationVariant;
  /** Optional heading. */
  title?: string;
  /** Body text. */
  message: string;
  /** W3C trace ID, when the triggering error carried one. */
  requestId?: string;
}

/** Parameters accepted by {@link useSkillEditorSubmit}. */
export interface UseSkillEditorSubmitParams {
  /** DIAL Core bucket the skill is saved to. */
  bucket: string | undefined;
  /** Whether the form is editing an existing skill rather than creating a new one. */
  isEditMode: boolean;
  /** The editor's current supporting-file tree. */
  files: SkillFileTreeNode[];
  /** In-memory bytes for every supporting file, keyed by relative path. */
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
  /** The loaded (or imported) manifest's full parsed frontmatter. */
  frontmatterRef: React.MutableRefObject<Record<string, unknown>>;
  /** The path the currently loaded edit-mode state belongs to. */
  loadedPathRef: React.MutableRefObject<string | undefined>;
  /** The concurrency ETag from the load, sent back as `If-Match` on save. */
  etagRef: React.MutableRefObject<string | undefined>;
  /** Where to navigate on a successful save. */
  returnUrl: string;
  /** Refetches the host's skill listing after a successful save. */
  refetchSkills: () => Promise<void>;
  /** Already-configured create/update operations. */
  client: SkillEditorSubmitClient;
  /** Localized messages, resolved by the host. */
  messages: SkillEditorSubmitMessages;
  /** Called with `returnUrl` after a successful save. */
  onNavigate: (url: string) => void;
  /** Called to surface a host notification (success toast or unexpected-error toast). */
  onNotify: (notification: SkillEditorSubmitNotification) => void;
}

/** Return value of {@link useSkillEditorSubmit}. */
export interface UseSkillEditorSubmitResult {
  /** Current submit-phase. */
  phase: SubmitPhase;
  /** Inline field validation errors. */
  errors: SkillEditorErrors;
  /** General submit-time error, distinct from a stale-edit `conflict`. */
  submitError: string | undefined;
  /** Present when the last save hit a stale-ETag conflict. */
  conflict: { message: string } | undefined;
  /** Clears `conflict`, e.g. once the host has reloaded the latest skill. */
  clearConflict: () => void;
  /** Validates and submits the given form values. */
  handleSubmit: (values: SkillEditorValues) => Promise<void>;
}

/**
 * Owns the Skill Editor's create/edit submission flow: field validation,
 * building and (in edit mode) merging the `SKILL.md` manifest, calling
 * `client.createSkill`/`client.updateSkill`, and mapping the resulting
 * success/error/conflict outcomes to presentable state.
 */
export const useSkillEditorSubmit = ({
  bucket,
  isEditMode,
  files,
  filesContentRef,
  frontmatterRef,
  loadedPathRef,
  etagRef,
  returnUrl,
  refetchSkills,
  client,
  messages,
  onNavigate,
  onNotify,
}: UseSkillEditorSubmitParams): UseSkillEditorSubmitResult => {
  const [errors, setErrors] = useState<SkillEditorErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [conflict, setConflict] = useState<{ message: string } | undefined>();
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const lastAttemptRef = useRef<LastAttempt | null>(null);

  const applyUploadErrorStatus = useCallback(
    async (err: unknown) => {
      const status = getApiErrorStatus(err);
      switch (status) {
        case 409:
          setErrors({ name: messages.nameConflict });
          return;
        case 412:
          /*
           * In edit mode this is a genuine stale-edit conflict, handled
           * separately by `handleSubmit` before this function is ever
           * called. In create mode it is unreachable (create never sends
           * `If-Match`) — treated defensively the same as `409` should it
           * ever occur, which would indicate an unexpected upstream change.
           */
          setErrors({ name: messages.nameConflict });
          return;
        case 413:
          setSubmitError(messages.archiveTooLarge);
          return;
        case 503:
          setSubmitError(messages.serviceUnavailable);
          return;
        case 400: {
          /*
           * A 400 has no single fixed cause (bad archive, rejected manifest
           * field, upstream request-shape issue, ...) — show the BFF's own
           * message (which now forwards DIAL Core's `upstreamMessage`)
           * instead of a fixed, potentially misleading guess.
           */
          const { message } = await getApiErrorDetails(err);
          setSubmitError(message ?? messages.pathInvalid);
          return;
        }
        default: {
          const { traceId } = await getApiErrorDetails(err);
          setSubmitError(messages.saveError);
          onNotify({
            variant: NotificationVariant.Error,
            message: messages.saveError,
            requestId: traceId,
          });
        }
      }
    },
    [messages, onNotify],
  );

  const handleSubmitCreate = useCallback(
    async (values: SkillEditorValues) => {
      const normalizedName = normalizeSkillName(values.name);
      if (!normalizedName || !isValidSkillRelativePath(normalizedName)) {
        setErrors({ name: messages.nameInvalid });
        return;
      }

      const fingerprint = fingerprintAttempt(values, files);
      const cached = lastAttemptRef.current;
      const canReuse = cached != null && cached.fingerprint === fingerprint;

      const path = normalizedName;
      let skillManifest: string;
      let filePaths: string[];
      let fileBlobs: Blob[];
      if (canReuse) {
        ({ skillManifest, filePaths, files: fileBlobs } = cached);
      } else {
        /*
         * A dropped SKILL.md's unknown frontmatter fields (e.g. `version`)
         * are preserved by merging into the imported frontmatter object
         * rather than always building a fresh one — `frontmatterRef` stays
         * `{}` unless a manifest was imported in this create session.
         */
        skillManifest = buildSkillManifestForSubmit(
          frontmatterRef.current,
          normalizedName,
          values.description,
          values.instructions,
        );
        ({ filePaths, files: fileBlobs } = buildSkillFilesPayload(
          files,
          filesContentRef.current,
        ));
      }

      setPhase('submitting');
      lastAttemptRef.current = {
        fingerprint,
        bucket: bucket as string,
        path,
        skillManifest,
        filePaths,
        files: fileBlobs,
      };

      try {
        await client.createSkill(
          bucket as string,
          path,
          skillManifest,
          filePaths,
          fileBlobs,
        );
        await refetchSkills();

        setPhase('success');
        onNotify({
          variant: NotificationVariant.Success,
          title: messages.saveSuccessTitle,
          message: messages.createSuccess(normalizedName),
        });
        onNavigate(returnUrl);
      } catch (err) {
        setPhase('failure');
        await applyUploadErrorStatus(err);
      }
    },
    [
      bucket,
      files,
      filesContentRef,
      frontmatterRef,
      messages,
      client,
      onNotify,
      onNavigate,
      returnUrl,
      refetchSkills,
      applyUploadErrorStatus,
    ],
  );

  const handleSubmitEdit = useCallback(
    async (values: SkillEditorValues) => {
      const path = loadedPathRef.current;
      const etag = etagRef.current;
      if (!path || !etag) {
        setSubmitError(messages.saveError);
        return;
      }

      const skillManifest = buildSkillManifestForSubmit(
        frontmatterRef.current,
        values.name,
        values.description,
        values.instructions,
      );
      const { filePaths, files: fileBlobs } = buildSkillFilesPayload(
        files,
        filesContentRef.current,
      );

      setPhase('submitting');
      try {
        const result = await client.updateSkill(
          bucket as string,
          path,
          skillManifest,
          filePaths,
          fileBlobs,
          etag,
        );
        etagRef.current = result.etag ?? etag;
        await refetchSkills();

        setPhase('success');
        onNotify({
          variant: NotificationVariant.Success,
          title: messages.updateSuccessTitle,
          message: messages.updateSuccess(values.name),
        });
        onNavigate(returnUrl);
      } catch (err) {
        setPhase('failure');
        const status = getApiErrorStatus(err);
        if (status === 412) {
          setConflict({ message: messages.conflictMessage });
          return;
        }
        await applyUploadErrorStatus(err);
      }
    },
    [
      bucket,
      files,
      filesContentRef,
      frontmatterRef,
      loadedPathRef,
      etagRef,
      messages,
      client,
      onNotify,
      onNavigate,
      returnUrl,
      refetchSkills,
      applyUploadErrorStatus,
    ],
  );

  const handleSubmit = useCallback(
    async (values: SkillEditorValues) => {
      if (phase === 'submitting' || !bucket) return;

      const nextErrors: SkillEditorErrors = {};
      if (!values.name.trim()) nextErrors.name = messages.required;
      if (!values.description.trim()) {
        nextErrors.description = messages.required;
      }
      if (!values.instructions.trim()) {
        nextErrors.instructions = messages.required;
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      setErrors({});
      setSubmitError(undefined);
      setConflict(undefined);

      if (isEditMode) {
        await handleSubmitEdit(values);
      } else {
        await handleSubmitCreate(values);
      }
    },
    [phase, bucket, messages, isEditMode, handleSubmitEdit, handleSubmitCreate],
  );

  return {
    phase,
    errors,
    submitError,
    conflict,
    clearConflict: () => setConflict(undefined),
    handleSubmit,
  };
};
