import { SaveVersionMode } from '@epam/ai-dial-publish-panel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ResourceSaveOutcome,
  runResourceSave,
  SaveDestinationRoot,
  toSaveDestinationRoot,
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
      isWrittenToOrgUnit: false,
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
      isWrittenToOrgUnit: false,
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

  describe('direct write into an org-unit folder', () => {
    const UNIT = {
      rootKey: SaveDestinationRoot.Organization,
      path: ['Acme', 'Teams'],
    };
    const UNIT_ID = 'applications/public/Acme/Teams/agent__1.0.0';
    const directChoice = (overrides: Partial<ResourceSaveChoice> = {}) =>
      choice({ destination: UNIT, isDirectWrite: true, ...overrides });
    const makeDirectAdapter = (
      overrides: Partial<ResourceEditSaveAdapter> = {},
    ) =>
      makeAdapter({
        saveIntoOrgUnit: vi.fn().mockResolvedValue({ id: UNIT_ID }),
        ...overrides,
      });

    it('Keep: saves in place, writes into the unit folder and sends no publish request', async () => {
      const adapter = makeDirectAdapter();

      const result = await runResourceSave(adapter, directChoice(), publish);

      expect(adapter.saveInPlace).toHaveBeenCalledOnce();
      expect(adapter.move).not.toHaveBeenCalled();
      expect(adapter.saveIntoOrgUnit).toHaveBeenCalledWith(ID, [
        'Acme',
        'Teams',
      ]);
      expect(publish).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        outcome: ResourceSaveOutcome.Saved,
        isWrittenToOrgUnit: true,
        isPublished: false,
      });
    });

    it('New: forks in the current Personal folder and writes the new id into the unit folder', async () => {
      const adapter = makeDirectAdapter();

      const result = await runResourceSave(
        adapter,
        directChoice({ versionMode: SaveVersionMode.New, newVersion: '1.1.0' }),
        publish,
      );

      expect(adapter.saveAsNewVersion).toHaveBeenCalledWith('1.1.0', [
        'Design',
      ]);
      expect(adapter.saveIntoOrgUnit).toHaveBeenCalledWith(
        'applications/b1/Design/agent__1.1.0',
        ['Acme', 'Teams'],
      );
      expect(publish).not.toHaveBeenCalled();
      expect(result.isNewVersion).toBe(true);
      expect(result.isWrittenToOrgUnit).toBe(true);
    });

    it('Create: creates at the Personal root, then writes into the unit folder', async () => {
      const NEW_ID = 'applications/b1/agent__1.0.0';
      const adapter: ResourceCreateSaveAdapter = {
        publishEntityType: 'application',
        isVersioned: false,
        createIn: vi.fn().mockResolvedValue({ id: NEW_ID }),
        saveIntoOrgUnit: vi.fn().mockResolvedValue({ id: UNIT_ID }),
      };

      const result = await runResourceSave(
        adapter,
        directChoice({ resourceId: '', currentFolderPath: [] }),
        publish,
      );

      expect(adapter.createIn).toHaveBeenCalledWith([]);
      expect(adapter.saveIntoOrgUnit).toHaveBeenCalledWith(NEW_ID, [
        'Acme',
        'Teams',
      ]);
      expect(publish).not.toHaveBeenCalled();
      expect(result.isCreated).toBe(true);
    });

    it('reports a failed direct write as a partial outcome after the save', async () => {
      const error = new Error('forbidden');
      const adapter = makeDirectAdapter({
        saveIntoOrgUnit: vi.fn().mockRejectedValue(error),
      });

      const result = await runResourceSave(adapter, directChoice(), publish);

      expect(result).toMatchObject({
        outcome: ResourceSaveOutcome.SavedButOrgUnitWriteFailed,
        savedId: ID,
        isWrittenToOrgUnit: false,
        error,
      });
      expect(publish).not.toHaveBeenCalled();
    });

    it('keeps the publish rows when the choice is not a direct write (unknown rights)', async () => {
      const adapter = makeDirectAdapter();

      const result = await runResourceSave(
        adapter,
        directChoice({ isDirectWrite: false }),
        publish,
      );

      expect(adapter.saveIntoOrgUnit).not.toHaveBeenCalled();
      expect(publish).toHaveBeenCalledOnce();
      expect(result.isPublished).toBe(true);
    });

    it('keeps the publish rows when the adapter has no direct write', async () => {
      const adapter = makeAdapter();

      const result = await runResourceSave(adapter, directChoice(), publish);

      expect(publish).toHaveBeenCalledOnce();
      expect(result.isPublished).toBe(true);
      expect(result.isWrittenToOrgUnit).toBe(false);
    });

    it('never takes the direct path for a Personal destination, even when flagged', async () => {
      const adapter = makeDirectAdapter();

      await runResourceSave(
        adapter,
        directChoice({
          destination: {
            rootKey: SaveDestinationRoot.Personal,
            path: ['Acme', 'Teams'],
          },
        }),
        publish,
      );

      expect(adapter.saveIntoOrgUnit).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('rejects when the first step fails, writing nothing', async () => {
      const adapter = makeDirectAdapter({
        saveInPlace: vi.fn().mockRejectedValue(new Error('boom')),
      });

      await expect(
        runResourceSave(adapter, directChoice(), publish),
      ).rejects.toThrow('boom');
      expect(adapter.saveIntoOrgUnit).not.toHaveBeenCalled();
    });
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
      );
    });
  });
});

describe('toSaveDestinationRoot', () => {
  it.each([SaveDestinationRoot.Personal, SaveDestinationRoot.Organization])(
    'returns the root named %s',
    (root) => {
      expect(toSaveDestinationRoot(root)).toBe(root);
    },
  );

  it('returns undefined for a key that is not a root', () => {
    expect(toSaveDestinationRoot('shared')).toBeUndefined();
  });
});
