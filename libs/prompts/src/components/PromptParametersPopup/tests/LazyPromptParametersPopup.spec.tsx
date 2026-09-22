import { act, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PromptParametersPopup } from '../../../index';

// Exercise the public root export without a host Suspense boundary.
describe('PromptParametersPopup root export', () => {
  // Compile the lazy UI before the interaction timeout; the packed fixture
  // separately verifies that consumers load it through a dynamic chunk.
  beforeAll(async () => {
    await import('../../../entry-points/parameters-popup');
  }, 30000);

  it('opens from a closed state and forwards the existing props and submit callback', async () => {
    const onSubmit = vi.fn();
    const props = {
      promptName: 'Compatible prompt',
      content: 'Hello {{name}}',
      parameters: [{ name: 'name', defaultValue: 'Ada' }],
      onClose: vi.fn(),
      onCancel: vi.fn(),
      onSubmit,
      labels: { submitLabel: 'Insert prompt' },
    };
    const { rerender } = render(
      <PromptParametersPopup {...props} open={false} />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<PromptParametersPopup {...props} open />);
    await act(() => vi.dynamicImportSettled());
    expect(await screen.findByText('Compatible prompt')).toBeTruthy();
    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'name' }).value,
    ).toBe('Ada');
    await userEvent.click(
      screen.getByRole('button', { name: 'Insert prompt' }),
    );
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: 'Ada' });
    rerender(<PromptParametersPopup {...props} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
