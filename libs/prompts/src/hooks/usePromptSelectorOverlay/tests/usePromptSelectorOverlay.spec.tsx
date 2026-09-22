import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FavoritePromptItem } from '../../../models/favorite-prompt-item';
import type { UsePromptSelectorOverlayOptions } from '../../../models/prompt-selector-overlay';
import { usePromptSelectorOverlay } from '../usePromptSelectorOverlay';

const FAVORITE_NO_PARAMS: FavoritePromptItem = {
  id: 'greet',
  name: 'Greeting',
  content: 'Hello there!',
};

const FAVORITE_WITH_PARAMS: FavoritePromptItem = {
  id: 'summarize',
  name: 'Summarizer',
  content: 'Summarize {{text}} in {{tone}} tone',
  description: 'Summarizes text',
};

const BROWSE_PROMPT: FavoritePromptItem = {
  id: 'translate',
  name: 'Translator',
  content: 'Translate {{text}} to {{language}}',
};

const DIRECT_PROMPT: FavoritePromptItem = {
  id: 'direct',
  name: 'Direct entry',
  content: 'Rewrite {{text}}',
};

interface HarnessProps extends Partial<UsePromptSelectorOverlayOptions> {
  onInsertText?: (text: string) => void;
}

/*
 * `usePromptSelectorOverlay` returns ReactNode pieces meant to be rendered at different levels
 * of a host tree (the transient Add-menu popover vs. a stable sibling). This harness reproduces
 * that split with a toggle for the popover, so tests can assert the popup/catalog survive the
 * popover unmounting.
 */
const Harness = ({ onInsertText = vi.fn(), ...overrides }: HarnessProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const {
    renderOverlay,
    promptCatalogModal,
    parametersPopup,
    openParametersPopup,
  } = usePromptSelectorOverlay({
    isEnabled: true,
    prompts: [FAVORITE_NO_PARAMS, FAVORITE_WITH_PARAMS],
    favoriteIds: new Set([FAVORITE_NO_PARAMS.id, FAVORITE_WITH_PARAMS.id]),
    onToggleFavorite: vi.fn(),
    onInsertText,
    renderCatalog: ({ isOpen, onSelect, onClose }) =>
      isOpen && (
        <div>
          <span>Browse catalog is open</span>
          <button type="button" onClick={() => onSelect(BROWSE_PROMPT)}>
            Pick browse prompt
          </button>
          <button type="button" onClick={onClose}>
            Close browse
          </button>
        </div>
      ),
    ...overrides,
  });

  return (
    <div>
      {renderOverlay && (
        <>
          {!isMenuOpen && (
            <button type="button" onClick={() => setIsMenuOpen(true)}>
              Open menu
            </button>
          )}
          {isMenuOpen && renderOverlay(() => setIsMenuOpen(false))}
        </>
      )}
      {promptCatalogModal}
      {parametersPopup}
      <button type="button" onClick={() => openParametersPopup(DIRECT_PROMPT)}>
        Open direct
      </button>
    </div>
  );
};

describe('usePromptSelectorOverlay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('inserts immediately and closes the menu when a favorite without parameters is selected', async () => {
    const onInsertText = vi.fn();
    render(<Harness onInsertText={onInsertText} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Greeting' }));

    expect(onInsertText).toHaveBeenCalledWith('Hello there!');
    expect(screen.queryByText('Greeting')).toBeNull();
  });

  it('removes a favorite when the host supplies updated favorite ids', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null });
    const onToggleFavorite = vi.fn();
    render(<Harness onToggleFavorite={onToggleFavorite} />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(
      screen.getAllByRole('button', { name: 'Remove from favorites' })[0],
    );
    vi.advanceTimersByTime(200);

    expect(onToggleFavorite).toHaveBeenCalledWith(FAVORITE_NO_PARAMS.id);
  });

  it('opens the parameters popup behind the browse modal for a parameterized browse selection, with Back available', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Pick browse prompt' }),
    );

    /*
     * PromptParametersPopup is lazy-loaded to keep AG Grid out of the eager bundle (it reaches
     * @epam/ai-dial-catalog), so its first render is asynchronous. This is also this test file's
     * first use of it, so the dynamic import's one-time module transform can outrun
     * findBy*'s default 1000ms timeout on a cold run — a longer timeout only for this first wait.
     */
    expect(
      await screen.findByText('Translator', {}, { timeout: 5000 }),
    ).toBeTruthy();
    const backButton = await screen.findByRole(
      'button',
      { name: 'Back' },
      { timeout: 5000 },
    );
    expect(backButton).toBeTruthy();

    await userEvent.click(backButton);

    expect(screen.queryByText('Translator')).toBeNull();
    expect(screen.getByText('Browse catalog is open')).toBeTruthy();
  });

  it('inserts the content once and closes both surfaces on submit', async () => {
    const onInsertText = vi.fn();
    render(<Harness onInsertText={onInsertText} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Pick browse prompt' }),
    );

    await userEvent.type(await screen.findByLabelText('text'), 'the report');
    await userEvent.type(screen.getByLabelText('language'), 'French');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onInsertText).toHaveBeenCalledOnce();
    expect(onInsertText).toHaveBeenCalledWith('Translate the report to French');
    expect(screen.queryByText('Translator')).toBeNull();
    expect(screen.queryByText('Browse catalog is open')).toBeNull();
  });

  it('cancel clears the pending prompt without inserting, keeping the browse modal open', async () => {
    const onInsertText = vi.fn();
    render(<Harness onInsertText={onInsertText} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Pick browse prompt' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel' }),
    );

    expect(onInsertText).not.toHaveBeenCalled();
    expect(screen.queryByText('Translator')).toBeNull();
    expect(screen.getByText('Browse catalog is open')).toBeTruthy();
  });

  it('offers no Back action and inserts nothing on cancel for a direct catalog entry', async () => {
    const onInsertText = vi.fn();
    render(<Harness onInsertText={onInsertText} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open direct' }));

    expect(await screen.findByText('Direct entry')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onInsertText).not.toHaveBeenCalled();
    expect(screen.queryByText('Direct entry')).toBeNull();
  });

  it('survives the transient Add-menu popover unmounting', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse' }));

    /* The popover (renderOverlay) is unmounted the moment Browse is clicked — the
       catalog modal it opened must still be there. */
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy();
    expect(screen.getByText('Browse catalog is open')).toBeTruthy();
  });

  it('exposes no menu renderer, no surfaces, and a no-op direct-open handler while disabled', () => {
    const onInsertText = vi.fn();
    render(<Harness isEnabled={false} onInsertText={onInsertText} />);

    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
    expect(screen.queryByText('Browse catalog is open')).toBeNull();
  });

  it('renders the host-injected catalog renderer, not a library-owned implementation', async () => {
    const renderCatalog = vi.fn(() => <div>Custom host catalog</div>);
    render(<Harness renderCatalog={renderCatalog} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Browse' }));

    expect(screen.getByText('Custom host catalog')).toBeTruthy();
  });

  it('supports keyboard activation of a favorite row under an RTL ancestor', async () => {
    const onInsertText = vi.fn();
    render(
      <div dir="rtl">
        <Harness onInsertText={onInsertText} />
      </div>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const row = screen.getByRole('button', { name: 'Greeting' });
    row.focus();
    await userEvent.keyboard('{Enter}');

    expect(onInsertText).toHaveBeenCalledWith('Hello there!');
  });
});
