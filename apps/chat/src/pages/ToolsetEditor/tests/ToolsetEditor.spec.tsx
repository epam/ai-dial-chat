import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as toolsetsApi from '../../../server-api/toolsets';
import { ROUTES } from '../../../types/routes';
import { ToolsetAuthTypes } from '../../../types/toolsets';
import ToolsetEditor from '../ToolsetEditor';

vi.mock('../../../server-api/toolsets', () => ({
  createToolset: vi.fn(),
  getToolset: vi.fn(),
  listToolsets: vi.fn(),
  loginToolset: vi.fn(),
  updateToolset: vi.fn(),
}));

vi.mock('../../../components/RouteFallback/RouteFallback', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('../ToolsetEditorHeader', () => ({
  default: ({ onSave }: { onSave: () => void }) => (
    <button type="button" onClick={onSave}>
      save-toolset
    </button>
  ),
}));

vi.mock('../ToolsetEditorView', () => ({
  default: ({
    onChange,
    onAuthChange,
  }: {
    onChange: (patch: Record<string, unknown>) => void;
    onAuthChange: (patch: Record<string, unknown>) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange({ endpoint: 'https://example.com/mcp' });
        onAuthChange({
          authenticationType: 'API_KEY',
          withLogin: 'with-login',
          keyHeader: 'X-API-Key',
          apiKey: 'secret',
        });
      }}
    >
      fill-api-key-toolset
    </button>
  ),
}));

const renderEditor = () =>
  render(
    <MemoryRouter initialEntries={[ROUTES.ToolsetEditor]}>
      <Routes>
        <Route path={ROUTES.ToolsetEditor} element={<ToolsetEditor />} />
        <Route path={ROUTES.Catalog} element={<div>Catalog</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ToolsetEditor', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(toolsetsApi.listToolsets).mockResolvedValue({ data: [] });
    vi.mocked(toolsetsApi.createToolset).mockResolvedValue({
      id: 'toolsets/b/my__0.0.1',
    });
    vi.mocked(toolsetsApi.loginToolset).mockResolvedValue({ success: true });
  });

  it('logs in a newly created API-key toolset using the returned id', async () => {
    renderEditor();

    await user.click(
      await screen.findByRole('button', {
        name: 'fill-api-key-toolset',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'save-toolset',
      }),
    );

    await waitFor(() =>
      expect(toolsetsApi.loginToolset).toHaveBeenCalledWith(
        'toolsets/b/my__0.0.1',
        expect.objectContaining({
          url: 'toolsets/b/my__0.0.1',
          authenticationType: ToolsetAuthTypes.ApiKey,
          apiKey: 'secret',
        }),
      ),
    );
  });
});
