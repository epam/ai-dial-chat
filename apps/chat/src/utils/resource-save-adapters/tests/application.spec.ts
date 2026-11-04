import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  commitApplicationVersion,
  deleteApplication,
  forkApplicationVersion,
  moveApplication,
} from '../../../server-api/applications';
import { ResourceSaveError } from '@epam/ai-dial-chat-hooks';
import {
  createEmbeddedApplicationSaveAdapter,
  createHostApplicationSaveAdapter,
} from '../application';

vi.mock('../../../server-api/applications', () => ({
  commitApplicationVersion: vi.fn(),
  deleteApplication: vi.fn(),
  forkApplicationVersion: vi.fn(),
  moveApplication: vi.fn(),
}));

const ID = 'applications/b1/agent__1.0.0';
const SNAPSHOT = 'applications/b1/Design/agent__1.1.0';

describe('createEmbeddedApplicationSaveAdapter', () => {
  const runEmbeddedSave = vi.fn();
  const adapter = createEmbeddedApplicationSaveAdapter({
    applicationId: ID,
    runEmbeddedSave,
    getCommitFailedMessage: (version) => `commit failed ${version}`,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    runEmbeddedSave.mockResolvedValue(undefined);
    vi.mocked(forkApplicationVersion).mockResolvedValue({ id: SNAPSHOT });
    vi.mocked(commitApplicationVersion).mockResolvedValue({ id: SNAPSHOT });
    vi.mocked(deleteApplication).mockResolvedValue(undefined);
  });

  it('saves in place through the embedded editor', async () => {
    await expect(adapter.saveInPlace()).resolves.toEqual({ id: ID });
    expect(runEmbeddedSave).toHaveBeenCalledOnce();
  });

  it('forks, saves, then commits a new version', async () => {
    const order: string[] = [];
    vi.mocked(forkApplicationVersion).mockImplementation(async () => {
      order.push('fork');
      return { id: SNAPSHOT };
    });
    runEmbeddedSave.mockImplementation(async () => {
      order.push('save');
    });
    vi.mocked(commitApplicationVersion).mockImplementation(async () => {
      order.push('commit');
      return { id: SNAPSHOT };
    });

    await expect(
      adapter.saveAsNewVersion?.('1.1.0', ['Design']),
    ).resolves.toEqual({ id: SNAPSHOT });
    expect(order).toEqual(['fork', 'save', 'commit']);
    expect(forkApplicationVersion).toHaveBeenCalledWith(ID, '1.1.0', 'Design');
    expect(commitApplicationVersion).toHaveBeenCalledWith(ID, SNAPSHOT);
  });

  it('deletes the snapshot and rethrows when the embedded save fails', async () => {
    const error = new Error('save failed');
    runEmbeddedSave.mockRejectedValue(error);

    await expect(adapter.saveAsNewVersion?.('1.1.0', [])).rejects.toBe(error);
    expect(deleteApplication).toHaveBeenCalledWith(SNAPSHOT);
    expect(commitApplicationVersion).not.toHaveBeenCalled();
  });

  it('reports a failed commit with a translated message', async () => {
    vi.mocked(commitApplicationVersion).mockRejectedValue(new Error('412'));

    const promise = adapter.saveAsNewVersion?.('1.1.0', []);
    await expect(promise).rejects.toBeInstanceOf(ResourceSaveError);
    await expect(promise).rejects.toThrow('commit failed 1.1.0');
  });

  it('moves into a Personal folder by its joined path', async () => {
    vi.mocked(moveApplication).mockResolvedValue({
      id: 'applications/b1/A/B/x',
    });
    await expect(adapter.move(ID, ['A', 'B'])).resolves.toEqual({
      id: 'applications/b1/A/B/x',
    });
    expect(moveApplication).toHaveBeenCalledWith(ID, 'A/B');
  });
});

describe('createHostApplicationSaveAdapter', () => {
  const update = vi.fn();
  const createVersion = vi.fn();
  const adapter = createHostApplicationSaveAdapter({
    applicationId: ID,
    update,
    createVersion,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue(undefined);
  });

  it('updates in place and keeps the id', async () => {
    await expect(adapter.saveInPlace()).resolves.toEqual({ id: ID });
    expect(update).toHaveBeenCalledOnce();
  });

  it('creates the new version in the folder without forking', async () => {
    createVersion.mockResolvedValue({ id: SNAPSHOT });

    await expect(
      adapter.saveAsNewVersion?.('1.1.0', ['Design']),
    ).resolves.toEqual({ id: SNAPSHOT });
    expect(createVersion).toHaveBeenCalledWith('1.1.0', ['Design']);
    expect(update).not.toHaveBeenCalled();
    expect(forkApplicationVersion).not.toHaveBeenCalled();
  });

  it('rejects a create that returns no id', async () => {
    createVersion.mockResolvedValue(undefined);
    await expect(adapter.saveAsNewVersion?.('1.1.0', [])).rejects.toThrow();
  });
});
