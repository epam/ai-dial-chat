import type { ToolsetBodyDto } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createToolset,
  moveToolset,
  updateToolset,
} from '../../../server-api/toolsets';
import { createToolsetSaveAdapter } from '../toolset';

vi.mock('../../../server-api/toolsets', () => ({
  createToolset: vi.fn(),
  moveToolset: vi.fn(),
  updateToolset: vi.fn(),
}));

const ID = 'toolsets/b1/search__1.0.0';
const body = { name: 'search', version: '1.0.0' } as ToolsetBodyDto;

describe('createToolsetSaveAdapter', () => {
  const adapter = createToolsetSaveAdapter({ toolsetId: ID, body });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the toolset in place', async () => {
    vi.mocked(updateToolset).mockResolvedValue({ id: ID });
    await expect(adapter.saveInPlace()).resolves.toEqual({ id: ID });
    expect(updateToolset).toHaveBeenCalledWith(ID, body);
  });

  it('creates a new version as a create-only write into the folder', async () => {
    vi.mocked(createToolset).mockResolvedValue({
      id: 'toolsets/b1/Search/search__1.1.0',
    });
    await adapter.saveAsNewVersion?.('1.1.0', ['Search']);
    expect(createToolset).toHaveBeenCalledWith({
      ...body,
      version: '1.1.0',
      createOnly: true,
      folderPath: 'Search',
    });
    expect(updateToolset).not.toHaveBeenCalled();
  });

  it('creates a new version at the root without a folder field', async () => {
    vi.mocked(createToolset).mockResolvedValue({ id: 'x' });
    await adapter.saveAsNewVersion?.('1.1.0', []);
    expect(createToolset).toHaveBeenCalledWith(
      expect.not.objectContaining({ folderPath: expect.anything() }),
    );
  });

  it('moves into a Personal folder', async () => {
    vi.mocked(moveToolset).mockResolvedValue({ id: 'y' });
    await adapter.move(ID, ['A', 'B']);
    expect(moveToolset).toHaveBeenCalledWith(ID, 'A/B');
  });
});
