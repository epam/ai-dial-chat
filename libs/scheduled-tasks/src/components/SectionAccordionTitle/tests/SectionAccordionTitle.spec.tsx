import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionAccordionTitle } from '../SectionAccordionTitle';

describe('SectionAccordionTitle', () => {
  it('renders the title as a block that escapes the kit title strut at the 24px design height', () => {
    render(
      <SectionAccordionTitle className="dial-tiny-semi-text">
        History
      </SectionAccordionTitle>,
    );

    const title = screen.getByText('History');
    expect(title.className).toContain('dial-tiny-semi-text');
    expect(title.className).toContain('block');
    expect(title.className).toContain('truncate');
    expect(title.className).toContain('py-1');
  });
});
