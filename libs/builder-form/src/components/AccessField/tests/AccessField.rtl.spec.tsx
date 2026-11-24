/* eslint-disable testing-library/no-node-access -- the check inspects the class names of the lib's own elements, which carry no role of their own */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ACCESS_FIELD_LABELS } from '../../../constants/access';
import { AccessLevel } from '../../../models/access';
import { AccessField } from '../AccessField';

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string): string =>
  readFileSync(join(here, relative), 'utf-8');

const PHYSICAL_CLASS =
  /(^|[\s:"'`])-?(ml|mr|pl|pr|left|right|float-left|float-right|text-left|text-right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr)(-|\s|["'`]|$)/;

const PHYSICAL_PROPERTY =
  /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(left|right)|float:\s*(left|right))\s*:/;

describe('AccessField right-to-left support', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('puts no physical-direction class on the section or the modal', async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = render(
      <AccessField
        value={[{ contentId: 'files', level: AccessLevel.Read }]}
        onChange={vi.fn()}
        contentOptions={[
          {
            id: 'files',
            label: 'Files',
            allowedAccess: [AccessLevel.Read, AccessLevel.ReadWrite],
          },
        ]}
        readOnlyChips={[{ id: 'p', label: 'Policies: Read' }]}
        noticeText="Needs approval"
        labels={DEFAULT_ACCESS_FIELD_LABELS}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Configure' }));

    /*
     * The kit renders its own markup inside; only the elements this lib
     * authors are checked, since a kit class is the kit's to mirror.
     */
    const section = container.firstElementChild as HTMLElement;
    const cards = within(screen.getByRole('dialog')).getAllByRole('group');
    const authored = [
      section,
      ...Array.from(section.children),
      section.querySelector('ul') as HTMLElement,
      ...cards,
      ...cards.flatMap((card) => Array.from(card.children)),
      cards[0].parentElement as HTMLElement,
    ];
    const classNames = authored
      .map((element) => element.getAttribute('class') ?? '')
      .join(' ');
    expect(classNames).toContain('flex');
    expect(classNames).not.toMatch(PHYSICAL_CLASS);
  });

  it.each([
    ['AccessField', '../AccessField.module.scss'],
    ['AccessModal', '../../AccessModal/AccessModal.module.scss'],
  ])(
    'keeps the %s stylesheet free of physical-direction properties',
    (_, path) => {
      expect(read(path)).not.toMatch(PHYSICAL_PROPERTY);
    },
  );

  it.each([
    ['AccessField', '../AccessField.tsx'],
    ['AccessModal', '../../AccessModal/AccessModal.tsx'],
  ])('mirrors every directional icon in %s', (_, path) => {
    const directionalIconTags =
      read(path).match(/<Icon(?:Arrow|Chevron|Caret)\w*[^>]*>/g) ?? [];
    const unmirrored = directionalIconTags.filter(
      (tag) => !tag.includes('rtl:scale-x-[-1]'),
    );
    expect(unmirrored).toEqual([]);
  });
});
