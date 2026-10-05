import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillSelectorField } from '../SkillSelectorField';

const selectProps = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    Select: (props: Record<string, unknown>) => {
      selectProps.current = props;
      return <input role="combobox" aria-label="Skills" />;
    },
  };
});

describe('SkillSelectorField Select contract', () => {
  it('uses the multiple Select with a viewport-bounded popup', () => {
    render(
      <SkillSelectorField
        value={[]}
        onChange={vi.fn()}
        skills={[]}
        isSkillsSupported
        labels={{
          fieldLabel: 'Skills',
          placeholder: 'Choose skills',
          unsupportedTooltipLabel: 'Unsupported',
        }}
      />,
    );

    expect(selectProps.current).toMatchObject({
      multiple: true,
      searchable: true,
      listClassName:
        'w-[min(var(--reference-width),calc(100vw-2rem))] max-w-full',
    });
  });
});
