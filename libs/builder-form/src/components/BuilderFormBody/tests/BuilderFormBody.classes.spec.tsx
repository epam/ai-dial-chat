import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BuilderFormBody } from '../BuilderFormBody';

/* Scroll ownership is expressed by utility classes and cannot be measured by jsdom. */
describe('BuilderFormBody scroll layout', () => {
  it('keeps overflow inside the body and gives desktop columns their own scrollers', () => {
    render(
      <BuilderFormBody
        left={<span>Details content</span>}
        metadata={<span>Metadata content</span>}
      >
        <span>Configuration content</span>
      </BuilderFormBody>,
    );

    /* These wrappers are intentionally structural and have no semantic role. */
    // eslint-disable-next-line testing-library/no-node-access
    const detailsColumn = screen.getByText('Details content').parentElement;
    const configurationContent = screen.getByText('Configuration content');
    // eslint-disable-next-line testing-library/no-node-access
    const configurationColumn = configurationContent.parentElement;
    // eslint-disable-next-line testing-library/no-node-access
    const metadataColumn = screen.getByText('Metadata content').parentElement;
    // eslint-disable-next-line testing-library/no-node-access
    const body = detailsColumn?.parentElement;

    expect(body?.classList).toContain('overflow-y-auto');
    expect(body?.classList).toContain('desktop:flex-row');
    expect(body?.classList).toContain('desktop:overflow-hidden');
    expect(detailsColumn?.classList).toContain('desktop:overflow-y-auto');
    expect(configurationColumn?.classList).toContain('desktop:overflow-y-auto');
    expect(metadataColumn?.classList).toContain('desktop:overflow-y-auto');
  });
});
