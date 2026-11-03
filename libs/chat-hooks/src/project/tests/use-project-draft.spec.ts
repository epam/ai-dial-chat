import {
  ProjectSource,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import {
  AttachmentType,
  RequestStatus,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mapStoredContextFiles } from '../project-mapping';
import {
  ProjectDraftMode,
  useProjectDraft,
  type UseProjectDraftOptions,
} from '../use-project-draft';

const project = (
  overrides: Partial<ProjectDetailsDto> = {},
): ProjectDetailsDto => ({
  id: 'projects/b/q4',
  name: 'q4',
  bucket: 'b',
  path: 'q4',
  source: ProjectSource.Personal,
  description: '',
  instructions: 'Be brief',
  contextFiles: [{ name: 'a.csv', size: 10 }],
  etag: '"e1"',
  contentVersion: '"cv1"',
  conversationCount: 0,
  canEdit: true,
  ...overrides,
});

const newFile = (name: string): Attachment => ({
  id: `new-${name}`,
  name,
  contentType: 'text/plain',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  file: new File(['x'], name, { type: 'text/plain' }),
});

const renderDraft = (options: UseProjectDraftOptions) =>
  renderHook((props: UseProjectDraftOptions) => useProjectDraft(props), {
    initialProps: options,
  });
const create = (): UseProjectDraftOptions => ({
  mode: ProjectDraftMode.Create,
});
const edit = (loaded: ProjectDetailsDto | null): UseProjectDraftOptions => ({
  mode: ProjectDraftMode.Edit,
  project: loaded,
});

describe('useProjectDraft — create', () => {
  it('starts empty, clean and ready', () => {
    const { result } = renderDraft(create());

    expect(result.current.values).toEqual({ name: '', instructions: '' });
    expect(result.current.contextFiles).toEqual([]);
    expect(result.current.errors).toEqual({});
    expect(result.current.isSeeded).toBe(true);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.removedFileNames).toEqual([]);
    expect(result.current.newFiles).toEqual([]);
  });

  it.each([
    [
      'a name is typed',
      (draft: ReturnType<typeof useProjectDraft>) =>
        draft.onFieldChange('name', 'Q4'),
    ],
    [
      'instructions are typed',
      (draft: ReturnType<typeof useProjectDraft>) =>
        draft.onFieldChange('instructions', 'Be brief'),
    ],
    [
      'a file is staged',
      (draft: ReturnType<typeof useProjectDraft>) =>
        draft.onContextFilesChange([newFile('n.txt')]),
    ],
  ])('becomes dirty once %s', (_, change) => {
    const { result } = renderDraft(create());

    act(() => change(result.current));

    expect(result.current.isDirty).toBe(true);
  });

  it('exposes the staged files as new files', () => {
    const { result } = renderDraft(create());
    const staged = newFile('n.txt');

    act(() => result.current.onContextFilesChange([staged]));

    expect(result.current.newFiles).toEqual([staged.file]);
    expect(result.current.removedFileNames).toEqual([]);
  });

  it('clears the name error when the name changes, and only then', () => {
    const { result } = renderDraft(create());
    act(() => result.current.setErrors({ name: 'taken', context: 'too many' }));

    act(() => result.current.onFieldChange('instructions', 'x'));
    expect(result.current.errors).toEqual({
      name: 'taken',
      context: 'too many',
    });

    act(() => result.current.onFieldChange('name', 'Q5'));
    expect(result.current.errors).toEqual({
      name: undefined,
      context: 'too many',
    });
  });
});

describe('useProjectDraft — edit', () => {
  it('is empty, unseeded and clean while no project is loaded', () => {
    const { result } = renderDraft(edit(null));

    expect(result.current.values).toEqual({ name: '', instructions: '' });
    expect(result.current.isSeeded).toBe(false);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.removedFileNames).toEqual([]);
    expect(result.current.newFiles).toEqual([]);
  });

  it('seeds the values and stored files from the loaded project and starts clean', () => {
    const loaded = project();
    const { result } = renderDraft(edit(loaded));

    expect(result.current.values).toEqual({
      name: 'q4',
      instructions: 'Be brief',
    });
    expect(result.current.contextFiles).toEqual(mapStoredContextFiles(loaded));
    expect(result.current.isSeeded).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it('seeds once the project arrives after the first render', () => {
    const { result, rerender } = renderDraft(edit(null));

    rerender(edit(project()));

    expect(result.current.values.name).toBe('q4');
    expect(result.current.isSeeded).toBe(true);
  });

  it('keeps an edit across a re-render with the same content version', () => {
    const { result, rerender } = renderDraft(edit(project()));
    act(() => result.current.onFieldChange('name', 'Renamed'));

    rerender(edit(project()));

    expect(result.current.values.name).toBe('Renamed');
    expect(result.current.isDirty).toBe(true);
  });

  it('replaces the draft and clears its errors when a new content version loads', () => {
    const { result, rerender } = renderDraft(edit(project()));
    act(() => {
      result.current.onFieldChange('name', 'Renamed');
      result.current.setErrors({ name: 'taken' });
    });

    rerender(
      edit(
        project({
          name: 'q4-remote',
          contentVersion: '"cv2"',
          contextFiles: [],
        }),
      ),
    );

    expect(result.current.values.name).toBe('q4-remote');
    expect(result.current.contextFiles).toEqual([]);
    expect(result.current.errors).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it('reports a removed stored file and an added one, and is dirty', () => {
    const { result } = renderDraft(edit(project()));
    const added = newFile('b.pdf');

    act(() => result.current.onContextFilesChange([added]));

    expect(result.current.removedFileNames).toEqual(['a.csv']);
    expect(result.current.newFiles).toEqual([added.file]);
    expect(result.current.isDirty).toBe(true);
  });
});
