import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PUBLISH_PANEL_CLASS } from '../../../constants/public-class-names';
import { PublishDependenciesAppearance } from '../../../models/publish-dependencies-list';
import type { PublishDependency } from '../../../models/publish-dependency';
import { PublishDependencyType } from '../../../models/publish-dependency';
import { PublishDependenciesList } from '../PublishDependenciesList';

/* The real icons draw images and glyphs a test cannot read by role; these state which icon a row asked for. */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  /* States which variant the section asked for, which the real notification only shows as styling. */
  Notification: (props: { variant: unknown; message: string }) => (
    <p data-variant={String(props.variant)} role="note">
      {props.message}
    </p>
  ),
  FileIcon: ({ type, name }: { type: string; name: string }) => (
    <span>
      file-icon:{type}:{name}
    </span>
  ),
}));
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  DeploymentIcon: ({
    src,
    initialsName,
  }: {
    src?: string;
    initialsName: string;
  }) => (
    <span>
      entity-icon:{src ?? 'none'}:{initialsName}
    </span>
  ),
}));

const prompt: PublishDependency = {
  id: 'prompts/b/Support/Greeting',
  name: 'Greeting',
  type: PublishDependencyType.Prompt,
  location: 'Support',
};
const toolset: PublishDependency = {
  id: 'toolsets/b/Search__1.0.0',
  name: 'Search',
  version: '1.0.0',
  type: PublishDependencyType.Toolset,
  location: '',
};

describe('PublishDependenciesList', () => {
  it('lists each dependency with its name, type and location', () => {
    render(<PublishDependenciesList dependencies={[prompt, toolset]} />);

    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Greeting')).toBeTruthy();
    expect(within(rows[0]).getByText('Prompt · Support')).toBeTruthy();
  });

  it('shows the version next to a versioned dependency', () => {
    render(<PublishDependenciesList dependencies={[toolset]} />);

    expect(screen.getByText('1.0.0')).toBeTruthy();
    expect(screen.getByText('Search')).toBeTruthy();
  });

  it('shows only the type for a dependency at the bucket root', () => {
    render(<PublishDependenciesList dependencies={[toolset]} />);

    expect(screen.getByText('Toolset')).toBeTruthy();
  });

  it('names the section by its heading and warns about the consequence', () => {
    render(<PublishDependenciesList dependencies={[prompt]} />);

    const section = screen.getByRole('region', {
      name: 'Private dependencies',
    });
    expect(section.className).toContain(PUBLISH_PANEL_CLASS.dependencies);
    expect(
      within(section).getByText(/depends on personal private resources/),
    ).toBeTruthy();
  });

  it('shows host-supplied labels instead of the English defaults', () => {
    render(
      <PublishDependenciesList
        dependencies={[prompt]}
        labels={{
          title: 'Приватные зависимости',
          typeLabels: { [PublishDependencyType.Prompt]: 'Промпт' },
        }}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'Приватные зависимости' }),
    ).toBeTruthy();
    expect(screen.getByText('Промпт · Support')).toBeTruthy();
    expect(screen.queryByText('Private dependencies')).toBeNull();
  });

  it('renders no heading, notification or list for an empty list', () => {
    render(<PublishDependenciesList dependencies={[]} />);

    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('announces the count through the same live region when the list appears', () => {
    const { rerender } = render(<PublishDependenciesList dependencies={[]} />);
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');

    rerender(<PublishDependenciesList dependencies={[prompt, toolset]} />);

    expect(screen.getByRole('status')).toBe(region);
    expect(region.textContent).toBe('2 dependencies are not public yet');
  });

  it('uses the host announcement text', () => {
    render(
      <PublishDependenciesList
        dependencies={[prompt]}
        labels={{ getAnnouncement: (count) => `Not public: ${count}` }}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Not public: 1');
  });

  describe('icons', () => {
    it("shows the entity's own icon for an application or toolset that has one", () => {
      render(
        <PublishDependenciesList
          dependencies={[{ ...toolset, iconUrl: '/icons/search.png' }]}
        />,
      );

      expect(
        screen.getByText('entity-icon:/icons/search.png:Search'),
      ).toBeTruthy();
    });

    it("falls back to the name's initials when the entity has no icon", () => {
      render(<PublishDependenciesList dependencies={[prompt]} />);

      expect(screen.getByText('entity-icon:none:Greeting')).toBeTruthy();
    });

    it('shows a file-type icon for a file, picked from its name', () => {
      render(
        <PublishDependenciesList
          dependencies={[
            {
              id: 'files/other/docs/report.pdf',
              name: 'report.pdf',
              type: PublishDependencyType.File,
              location: 'docs',
            },
          ]}
        />,
      );

      expect(screen.getByText('file-icon:file:report.pdf')).toBeTruthy();
      expect(screen.queryByText(/entity-icon/)).toBeNull();
    });

    it('shows the folder icon for a folder attachment', () => {
      render(
        <PublishDependenciesList
          dependencies={[
            {
              id: 'files/other/docs/',
              name: 'docs',
              type: PublishDependencyType.File,
              isFolder: true,
              location: '',
            },
          ]}
        />,
      );

      expect(screen.getByText('file-icon:folder:docs')).toBeTruthy();
    });
  });

  describe('appearance', () => {
    it('is a warning with the default texts when the host passes nothing', () => {
      render(<PublishDependenciesList dependencies={[prompt]} />);

      expect(screen.getByRole('note').dataset.variant).toBe('warning');
      expect(
        screen.getByRole('heading', { name: 'Private dependencies' }),
      ).toBeTruthy();
    });

    it('shows a plain caption and no notification for Published', () => {
      render(
        <PublishDependenciesList
          dependencies={[prompt]}
          labels={{
            title: 'Dependencies',
            description: 'Published with the application.',
            appearance: PublishDependenciesAppearance.Published,
          }}
        />,
      );

      expect(screen.queryByRole('note')).toBeNull();
      expect(screen.getByText('Published with the application.')).toBeTruthy();
      expect(
        screen.getByRole('heading', { name: 'Dependencies' }),
      ).toBeTruthy();
    });

    it('puts the type label above the name for Published', () => {
      render(
        <PublishDependenciesList
          dependencies={[prompt]}
          labels={{ appearance: PublishDependenciesAppearance.Published }}
        />,
      );

      const row = within(screen.getByRole('list')).getByRole('listitem');
      const label = within(row).getByText('Prompt');
      const names = within(row).getAllByText(prompt.name);
      const name = names[names.length - 1];
      expect(
        label.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('keeps the location beside the type label for Published', () => {
      render(
        <PublishDependenciesList
          dependencies={[prompt]}
          labels={{ appearance: PublishDependenciesAppearance.Published }}
        />,
      );

      expect(screen.getByText('· Support')).toBeTruthy();
    });

    it('lists every dependency for Published', () => {
      render(
        <PublishDependenciesList
          dependencies={[prompt, toolset]}
          labels={{ appearance: PublishDependenciesAppearance.Published }}
        />,
      );

      expect(
        within(screen.getByRole('list')).getAllByRole('listitem'),
      ).toHaveLength(2);
    });
  });
});
