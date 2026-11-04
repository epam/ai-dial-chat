import { SaveVersionMode } from '@epam/ai-dial-publish-panel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ResourceSaveOutcome,
  runResourceSave,
  SaveDestinationRoot,
  type ResourceCreateSaveAdapter,
  type ResourceEditSaveAdapter,
  type ResourceSaveChoice,
} from '../resource-save';

const ID = 'applications/b1/Design/agent__1.0.0';

const makeAdapter = (
  overrides: Partial<ResourceEditSaveAdapter> = {},
): ResourceEditSaveAdapter => ({
  publishEntityType: 'application',
  isVersioned: true,
  saveInPlace: vi.fn().mockResolvedValue({ id: ID }),
  saveAsNewVersion: vi
    .fn()
    .mockResolvedValue({ id: 'applications/b1/Design/agent__1.1.0' }),
  move: vi.fn().mockResolvedValue({ id: 'applications/b1/Sales/agent__1.0.0' }),
  ...overrides,
});

const choice = (
  overrides: Partial<ResourceSaveChoice> = {},
): ResourceSaveChoice => ({
  resourceId: ID,
  currentFolderPath: ['Design'],
  currentVersion: '1.0.0',
  destination: { rootKey: SaveDestinationRoot.Personal, path: ['Design'] },
  versionMode: SaveVersionMode.Keep,
  newVersion: '',
  ...overrides,
});

describe('runResourceSave', () => {
  const publish = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    publish.mockResolvedValue(undefined);
  });

  it('saves in place and does nothing else for the same Personal folder', async () => {
    const adapter = makeAdapter();
    const result = await runResourceSave(adapter, choice(), publish);

    expect(adapter.saveInPlace).toHaveBeenCalledOnce();
    expect(adapter.move).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: ResourceSaveOutcome.Saved,
      savedId: ID,
      isCreated: false,
      isNewVersion: false,
      isPublished: false,
    });
  });

  it('saves then moves into a different Personal folder', async () => {
    const adapter = makeAdapter();
    const result = await runResourceSave(
      adapter,
      choice({
        destination: { rootKey: SaveDestinationRoot.Personal, path: ['Sales'] },
      }),
      publish,
    );

    expect(adapter.move).toHaveBeenCalledWith(ID, ['Sales']);
    expect(result.savedId).toBe('applications/b1/Sales/agent__1.0.0');
    expect(result.outcome).toBe(ResourceSaveOutcome.Saved);
  });

  it('reports a failed move after a successful save', async () => {
    const error = new Error('taken');
    const adapter = makeAdapter({ move: vi.fn().mockRejectedValue(error) });
    const result = await runResourceSave(
      adapter,
      choice({
        destination: { rootKey: SaveDestinationRoot.Personal, path: [] },
      }),
      publish,
    );

    expect(result).toEqual({
      outcome: ResourceSaveOutcome.SavedButMoveFailed,
      savedId: ID,
      isCreated: false,
      isNewVersion: false,
      isPublished: false,
      error,
    });
  });

  it('writes a new version straight into the chosen Personal folder', async () => {
    const adapter = makeAdapter();
    const result = await runResourceSave(
      adapter,
      choice({
        versionMode: SaveVersionMode.New,
        newVersion: '1.1.0',
        destination: { rootKey: SaveDestinationRoot.Personal, path: ['Sales'] },
      }),
      publish,
    );

    expect(adapter.saveAsNewVersion).toHaveBeenCalledWith('1.1.0', ['Sales']);
    expect(adapter.saveInPlace).not.toHaveBeenCalled();
    expect(adapter.move).not.toHaveBeenCalled();
    expect(result.isNewVersion).toBe(true);
  });

  it('ignores the version mode of an unversioned resource', async () => {
    const adapter = makeAdapter({
      isVersioned: false,
      saveAsNewVersion: undefined,
    });
    await runResourceSave(
      adapter,
      choice({ versionMode: SaveVersionMode.New, newVersion: '2.0.0' }),
      publish,
    );

    expect(adapter.saveInPlace).toHaveBeenCalledOnce();
  });

  it('saves in the current folder then publishes to an Organization folder', async () => {
    const adapter = makeAdapter();
    const result = await runResourceSave(
      adapter,
      choice({
        destination: {
          rootKey: SaveDestinationRoot.Organization,
          path: ['EPAM', 'Delivery'],
        },
      }),
      publish,
    );

    expect(adapter.move).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith(
      'application',
      ID,
      ['EPAM', 'Delivery'],
      '1.0.0',
      [],
    );
    expect(result.isPublished).toBe(true);
  });

  it('forks in the current folder and publishes the new version', async () => {
    const adapter = makeAdapter();
    await runResourceSave(
      adapter,
      choice({
        versionMode: SaveVersionMode.New,
        newVersion: '1.1.0',
        destination: {
          rootKey: SaveDestinationRoot.Organization,
          path: ['EPAM'],
        },
      }),
      publish,
    );

    expect(adapter.saveAsNewVersion).toHaveBeenCalledWith('1.1.0', ['Design']);
    expect(publish).toHaveBeenCalledWith(
      'application',
      'applications/b1/Design/agent__1.1.0',
      ['EPAM'],
      '1.1.0',
      [],
    );
  });

  it('reports a failed publish after a successful save', async () => {
    const error = new Error('denied');
    publish.mockRejectedValue(error);
    const result = await runResourceSave(
      makeAdapter(),
      choice({
        destination: {
          rootKey: SaveDestinationRoot.Organization,
          path: ['EPAM'],
        },
      }),
      publish,
    );

    expect(result.outcome).toBe(ResourceSaveOutcome.SavedButPublishFailed);
    expect(result.isPublished).toBe(false);
    expect(result.error).toBe(error);
  });

  it('rejects when the first step fails', async () => {
    const adapter = makeAdapter({
      saveInPlace: vi.fn().mockRejectedValue(new Error('boom')),
    });

    await expect(runResourceSave(adapter, choice(), publish)).rejects.toThrow(
      'boom',
    );
    expect(publish).not.toHaveBeenCalled();
  });

  describe('creating', () => {
    const NEW_ID = 'applications/b1/Sales/agent__1.0.0';
    const makeCreateAdapter = (): ResourceCreateSaveAdapter => ({
      publishEntityType: 'application',
      isVersioned: false,
      createIn: vi.fn().mockResolvedValue({ id: NEW_ID }),
    });
    const createChoice = (destination: ResourceSaveChoice['destination']) =>
      choice({ resourceId: '', currentFolderPath: [], destination });

    it('creates straight in the chosen Personal folder without moving', async () => {
      const adapter = makeCreateAdapter();
      const result = await runResourceSave(
        adapter,
        createChoice({
          rootKey: SaveDestinationRoot.Personal,
          path: ['Sales'],
        }),
        publish,
      );

      expect(adapter.createIn).toHaveBeenCalledWith(['Sales']);
      expect(publish).not.toHaveBeenCalled();
      expect(result.savedId).toBe(NEW_ID);
    });

    it('creates at the Personal root then publishes to an Organization folder', async () => {
      const adapter = makeCreateAdapter();
      await runResourceSave(
        adapter,
        createChoice({
          rootKey: SaveDestinationRoot.Organization,
          path: ['EPAM'],
        }),
        publish,
      );

      expect(adapter.createIn).toHaveBeenCalledWith([]);
      expect(publish).toHaveBeenCalledWith(
        'application',
        NEW_ID,
        ['EPAM'],
        '1.0.0',
        [],
      );
    });
  });
});
