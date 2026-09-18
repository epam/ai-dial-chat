import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SKILLS_CLASS } from '../../../constants/public-class-names';
import { FavoriteSkillsPanel } from '../../FavoriteSkillsPanel/FavoriteSkillsPanel';
import { ChatSkill } from '../ChatSkill';

/*
 * The public class names are this package's styling contract. A lost class
 * fails silently — the build passes, types pass, lint passes, and a host's
 * stylesheet simply stops applying — so each one is asserted here.
 *
 * Each case locates its element by role or text first: querying *by* the class
 * would still pass with the class on the wrong node.
 */

/*
 * The panel root carries no role of its own, so the assertion walks up from its
 * heading.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

describe('skills — public class names', () => {
  it('stamps the composer chip', () => {
    render(
      <ChatSkill
        name="summarize"
        path="skills/summarize"
        onViewDetails={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: '/summarize' }).classList,
    ).toContain(SKILLS_CLASS.chip);
  });

  it('keeps the chip class in the unsupported state', () => {
    render(
      <ChatSkill
        name="summarize"
        path="skills/summarize"
        isUnsupported
        onViewDetails={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: '/summarize' }).classList,
    ).toContain(SKILLS_CLASS.chip);
  });

  it('stamps the favorites panel root', () => {
    render(
      <FavoriteSkillsPanel
        favorites={[]}
        onSelect={vi.fn()}
        onToggleFavorite={vi.fn()}
        onBrowse={vi.fn()}
        onViewDetails={vi.fn()}
      />,
    );

    expect(
      closestWithClass(
        screen.getByText('My Collection'),
        SKILLS_CLASS.favoritesPanel,
      ),
    ).toBeTruthy();
  });
});
