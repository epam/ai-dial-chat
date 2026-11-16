import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorSection } from '../EditorSection';

describe('EditorSection', () => {
  it('names the section after its title', () => {
    render(
      <EditorSection title="Setup">
        <p>Body</p>
      </EditorSection>,
    );
    expect(screen.getByRole('region', { name: 'Setup' })).toBeTruthy();
  });

  it('leaves an untitled section unnamed', () => {
    render(
      <EditorSection>
        <p>Body</p>
      </EditorSection>,
    );
    expect(screen.queryByRole('region')).toBeNull();
  });
});
