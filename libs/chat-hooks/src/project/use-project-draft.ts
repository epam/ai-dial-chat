import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import {
  isStoredContextFile,
  type ProjectContextFile,
  type ProjectCreateFormErrors,
  type ProjectCreateFormValues,
} from '@epam/ai-dial-projects';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { mapStoredContextFiles } from './project-mapping';

/** Which project form a {@link useProjectDraft} draft backs. */
export enum ProjectDraftMode {
  /** The New project form: empty at the start, nothing stored yet. */
  Create = 'create',
  /** The Edit project form: seeded from a loaded project. */
  Edit = 'edit',
}

/** Mode of a {@link useProjectDraft} draft, and the loaded project of an edit draft. */
export type UseProjectDraftOptions =
  | {
      /** The New project form. */
      mode: ProjectDraftMode.Create;
    }
  | {
      /** The Edit project form. */
      mode: ProjectDraftMode.Edit;
      /** The loaded project, or `null` while none is; the draft is seeded once per its `contentVersion`. */
      project: ProjectDetailsDto | null;
    };

/** State and handlers of a project form draft. */
export interface UseProjectDraftResult {
  /** Name and instructions as typed. */
  values: ProjectCreateFormValues;
  /** The form's context file cards: stored files (edit mode) and files added in this session. */
  contextFiles: ProjectContextFile[];
  /** Field errors the host set, e.g. from a rejected request. */
  errors: ProjectCreateFormErrors;
  /** Sets the field errors, for a rejection the host maps to a field. */
  setErrors: Dispatch<SetStateAction<ProjectCreateFormErrors>>;
  /** Changes one text field; a change to the name clears its error. */
  onFieldChange: <K extends keyof ProjectCreateFormValues>(
    field: K,
    value: ProjectCreateFormValues[K],
  ) => void;
  /** Replaces the context file cards and clears the context error. */
  onContextFilesChange: (files: ProjectContextFile[]) => void;
  /** Whether the draft is ready to submit: always in create mode, once seeded from the loaded project in edit mode. */
  isSeeded: boolean;
  /** Whether the draft holds edits that leaving would discard. */
  isDirty: boolean;
  /** Names of stored files the user removed (edit mode); empty in create mode. */
  removedFileNames: string[];
  /** Files added in this session, not yet stored. */
  newFiles: File[];
}

const EMPTY_VALUES: ProjectCreateFormValues = { name: '', instructions: '' };
const NO_FILES: ProjectContextFile[] = [];

/** Owns the form state of the New project and Edit project pages: values, context files, field errors, dirtiness, and the removed and new files a save sends. */
export const useProjectDraft = (
  options: UseProjectDraftOptions,
): UseProjectDraftResult => {
  const project =
    options.mode === ProjectDraftMode.Edit ? options.project : null;
  const isEdit = options.mode === ProjectDraftMode.Edit;

  const [values, setValues] = useState<ProjectCreateFormValues>(EMPTY_VALUES);
  const [contextFiles, setContextFiles] =
    useState<ProjectContextFile[]>(NO_FILES);
  const [errors, setErrors] = useState<ProjectCreateFormErrors>({});
  const [seededContentVersion, setSeededContentVersion] = useState<
    string | null
  >(null);

  /* The edit draft is seeded once per loaded version, so a reload after a
   * conflict replaces it and a re-render never does. */
  useEffect(() => {
    if (
      !isEdit ||
      project == null ||
      project.contentVersion === seededContentVersion
    ) {
      return;
    }
    setValues({ name: project.name, instructions: project.instructions });
    setContextFiles(mapStoredContextFiles(project));
    setErrors({});
    setSeededContentVersion(project.contentVersion);
  }, [isEdit, project, seededContentVersion]);

  const removedFileNames = useMemo(() => {
    if (project == null) return [];
    const kept = new Set(
      contextFiles.filter(isStoredContextFile).map((file) => file.name),
    );
    return project.contextFiles
      .map((file) => file.name)
      .filter((name) => !kept.has(name));
  }, [project, contextFiles]);
  const newFiles = useMemo(
    () =>
      contextFiles.flatMap((file) =>
        isStoredContextFile(file) ? [] : [file.file],
      ),
    [contextFiles],
  );

  const isSeeded =
    !isEdit ||
    (project != null && seededContentVersion === project.contentVersion);
  const isDirty = isEdit
    ? project != null &&
      isSeeded &&
      (values.name !== project.name ||
        values.instructions !== project.instructions ||
        removedFileNames.length > 0 ||
        newFiles.length > 0)
    : values.name !== '' ||
      values.instructions !== '' ||
      contextFiles.length > 0;

  const onFieldChange = useCallback(
    <K extends keyof ProjectCreateFormValues>(
      field: K,
      value: ProjectCreateFormValues[K],
    ) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      if (field === 'name') {
        setErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev));
      }
    },
    [],
  );

  const onContextFilesChange = useCallback((files: ProjectContextFile[]) => {
    setContextFiles(files);
    setErrors((prev) =>
      prev.context ? { ...prev, context: undefined } : prev,
    );
  }, []);

  return {
    values,
    contextFiles,
    errors,
    setErrors,
    onFieldChange,
    onContextFilesChange,
    isSeeded,
    isDirty,
    removedFileNames,
    newFiles,
  };
};
