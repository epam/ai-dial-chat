import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingAnchor } from '../../../models/onboarding-tour';
import { OnboardingAnchorMap } from '../OnboardingAnchorMap';

const anchorsFixture = (): OnboardingAnchor[] => [
  { id: 'new-chat', getTarget: () => screen.queryByLabelText('New chat') },
  { id: 'catalog-create', getTarget: () => null },
];

const renderMap = (
  props: Partial<Parameters<typeof OnboardingAnchorMap>[0]> = {},
) =>
  render(
    <>
      <button type="button" aria-label="New chat">
        +
      </button>
      <OnboardingAnchorMap
        anchors={anchorsFixture()}
        onClose={vi.fn()}
        {...props}
      />
    </>,
  );

describe('OnboardingAnchorMap', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 10,
      y: 40,
      top: 40,
      left: 10,
      right: 50,
      bottom: 60,
      width: 40,
      height: 20,
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tags each anchor on screen with its name', async () => {
    renderMap();
    expect(await screen.findByText('new-chat')).toBeTruthy();
  });

  it('counts the anchors on screen and lists the missing ones', async () => {
    renderMap();
    const panel = await screen.findByRole('region', {
      name: '1 of 2 anchors on this page',
    });
    expect(within(panel).getByText('Not on this page')).toBeTruthy();
    expect(within(panel).getByRole('listitem').textContent).toBe(
      'catalog-create',
    );
  });

  it('says so when every anchor is on screen', async () => {
    renderMap({ anchors: [anchorsFixture()[0]] });
    expect(
      await screen.findByRole('region', {
        name: '1 of 1 anchors on this page',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Every anchor is on this page')).toBeTruthy();
  });

  it('calls onClose from the panel close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderMap({ onClose, labels: { close: 'Schließen' } });
    await user.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders host labels', async () => {
    renderMap({
      labels: {
        summary: (found, total) => `${found}/${total}`,
        missingHeading: 'Fehlt',
      },
    });
    expect(await screen.findByRole('region', { name: '1/2' })).toBeTruthy();
    expect(screen.getByText('Fehlt')).toBeTruthy();
  });
});
