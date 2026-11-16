import { Catalog } from '@epam/ai-dial-catalog';
import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveOnboardingTarget,
  type OnboardingTargetLabels,
} from '../onboarding-targets';

/*
 * The resolvers know the markup of other libs. These cases render those libs'
 * real components with the labels the app passes them, so a change to a
 * role, a landmark or a label wiring in `catalog` or `conversation-input`
 * fails here instead of silently dropping a hint in production.
 */

const SEND = 'Send message';
const ADD = 'Add';
const CATALOG = 'Catalog';
const CREATE = 'Create';
const VIEW_TOGGLE = 'View mode';

const labels = {
  catalog: CATALOG,
  catalogCreate: CREATE,
  catalogViewMode: VIEW_TOGGLE,
  sendMessage: SEND,
  addAttachment: ADD,
} as OnboardingTargetLabels;

const resolve = (target: OnboardingHintTarget) =>
  resolveOnboardingTarget(target, labels, 'main-content');

describe('onboarding anchors on the real UI', () => {
  beforeEach(() => {
    /* jsdom lays nothing out; give every element a box. */
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
      { top: 0, left: 0, width: 10, height: 10 },
    ] as unknown as DOMRectList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finds the composer, its Send button and its + button in ConversationInput', async () => {
    /* The app loads this lib lazily, so the test does too. */
    const { ConversationInput } =
      await import('@epam/ai-dial-conversation-input');
    render(
      <main id="main-content">
        <ConversationInput
          sendLabel={SEND}
          addMenuTitle={ADD}
          onSend={vi.fn()}
          onUploadAttachment={vi.fn()}
        />
      </main>,
    );
    const send = screen.getByRole('button', { name: SEND });
    const composer = resolve(OnboardingHintTarget.ConversationInput);
    expect(composer?.contains(screen.getByRole('textbox'))).toBe(true);
    expect(composer?.contains(send)).toBe(true);
    expect(resolve(OnboardingHintTarget.SendMessage)).toBe(send);
    expect(resolve(OnboardingHintTarget.AddAttachment)).toBe(
      screen.getByRole('button', { name: ADD }),
    );
  });

  it('finds the catalog region, its search, view switch and Create button in Catalog', async () => {
    render(
      <main id="main-content">
        <Catalog
          items={[]}
          favorites={[]}
          titles={{
            ariaLabel: CATALOG,
            viewToggleLabel: VIEW_TOGGLE,
            createLabel: CREATE,
          }}
          createOptions={[{ key: 'agent', label: 'Agent' }]}
        />
      </main>,
    );
    const region = await screen.findByRole('region', { name: CATALOG });
    await waitFor(() =>
      expect(resolve(OnboardingHintTarget.CatalogSearch)).toBe(
        within(region).getByRole('search'),
      ),
    );
    expect(resolve(OnboardingHintTarget.CatalogViewMode)).toBe(
      within(region).getByRole('radiogroup', { name: VIEW_TOGGLE }),
    );
    expect(resolve(OnboardingHintTarget.CatalogCreate)).toBe(
      within(region).getByRole('button', { name: CREATE }),
    );
  });
});
