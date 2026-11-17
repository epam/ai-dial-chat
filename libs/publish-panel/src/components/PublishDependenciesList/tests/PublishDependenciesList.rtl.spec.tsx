import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PublishDependency } from '../../../models/publish-dependency';
import { PublishDependencyType } from '../../../models/publish-dependency';
import { PublishDependenciesList } from '../PublishDependenciesList';

const PHYSICAL_DIRECTION_CLASS =
  /(^|\s)(ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)(-|\s|$)/;

const dependency: PublishDependency = {
  id: 'skills/b/Docs__1.0.0',
  name: 'Docs',
  version: '1.0.0',
  type: PublishDependencyType.Skill,
  location: 'Team',
};

describe('PublishDependenciesList — RTL', () => {
  it('renders under a right-to-left ancestor', () => {
    render(
      <div dir="rtl">
        <PublishDependenciesList dependencies={[dependency]} />
      </div>,
    );

    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getByText('Docs')).toBeTruthy();
  });

  it('uses no physical-direction class on the section, heading, list or rows', () => {
    render(<PublishDependenciesList dependencies={[dependency]} />);

    const elements = [
      screen.getByRole('region'),
      screen.getByRole('heading'),
      screen.getByRole('list'),
      screen.getByRole('listitem'),
    ];
    const offenders = elements
      .map((element) => element.getAttribute('class') ?? '')
      .filter((className) => PHYSICAL_DIRECTION_CLASS.test(className));
    expect(offenders).toEqual([]);
  });
});
