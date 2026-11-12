import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PUBLISH_PANEL_CLASS } from '../../../constants/public-class-names';
import {
  PublicationRuleFunction,
  PublishFolderNode,
  PublishResourceSummary,
} from '../../../models/publish';
import { PublishDependencyType } from '../../../models/publish-dependency';
import { PublishPanelView } from '../../../types/publish-panel';
import { PublishPanel } from '../PublishPanel';

interface MockDropdownItem {
  key: string;
  label?: ReactNode;
  onClick?: (info: { key: string; domEvent: MouseEvent }) => void;
}

// Dropdown uses floating-ui which can't position in jsdom — mock it as a
// plain listbox so option interaction works in tests (matches the convention
// used in Filter.spec.tsx: render children + a clickable list of items).
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    Dropdown: ({
      children,
      items,
    }: {
      children: ReactNode;
      items?: MockDropdownItem[];
    }) => (
      <div>
        {children}
        <div role="listbox">
          {items?.map((item) => (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={false}
              onClick={(e) =>
                item.onClick?.({
                  key: item.key,
                  domEvent: e.nativeEvent as unknown as MouseEvent,
                })
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    ),
  };
});

const resource: PublishResourceSummary = {
  title: 'ali.deepseek-v4-flash',
  version: '4.0.1',
};

const folderItems: PublishFolderNode[] = [
  {
    path: ['Shared'],
    name: 'Shared',
    children: [
      {
        path: ['Shared', 'Data Science'],
        name: 'Data Science',
        children: [
          {
            path: ['Shared', 'Data Science', 'Published models'],
            name: 'Published models',
          },
        ],
      },
    ],
  },
];

const renderPanel = (props?: Partial<ComponentProps<typeof PublishPanel>>) =>
  render(
    <PublishPanel
      resource={resource}
      folderItems={folderItems}
      onChangeFolderClick={vi.fn()}
      onPendingFolderPathChange={vi.fn()}
      onCreateFolder={vi.fn()}
      hasExistingPublicationInFolder={false}
      hasWriteAccess={true}
      isSubmitting={false}
      author=""
      onAuthorChange={vi.fn()}
      rules={[]}
      onRulesChange={vi.fn()}
      ruleSourceOptions={['title', 'role', 'dial_roles']}
      {...props}
    />,
  );

describe('PublishPanel', () => {
  it('renders the resource title when no renderSummary is provided', () => {
    renderPanel();
    expect(screen.getByText('ali.deepseek-v4-flash')).toBeTruthy();
  });

  it('renders the renderSummary slot in place of the default title row', () => {
    renderPanel({
      renderSummary: () => <div>Custom entity header</div>,
    });
    expect(screen.getByText('Custom entity header')).toBeTruthy();
    expect(screen.queryByText('ali.deepseek-v4-flash')).toBeNull();
  });

  it('renders the entity-header row with the version inline after the name when the resource has a type', () => {
    renderPanel({ resource: { ...resource, type: CatalogEntityType.Model } });
    expect(screen.getByText(CatalogEntityType.Model)).toBeTruthy();
    expect(screen.getByText('4.0.1')).toBeTruthy();
    expect(screen.queryByText(/· current/)).toBeNull();
  });

  it('ignores renderSummary once the resource carries a type', () => {
    renderPanel({
      resource: { ...resource, type: CatalogEntityType.Model },
      renderSummary: () => <div>Custom entity header</div>,
    });
    expect(screen.queryByText('Custom entity header')).toBeNull();
  });

  describe('credentials opt-in', () => {
    const CREDENTIALS_LABEL = 'Publish with my credentials';

    it('renders nothing when no change handler is supplied', () => {
      renderPanel();
      expect(screen.queryByLabelText(CREDENTIALS_LABEL)).toBeNull();
      expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('renders the checkbox with its default label once a handler is supplied', () => {
      renderPanel({ onPublishCredentialsChange: vi.fn() });
      expect(screen.getByRole('checkbox')).toBeTruthy();
      expect(screen.getByText(CREDENTIALS_LABEL)).toBeTruthy();
    });

    it('renders host-supplied label and caption in place of the defaults', () => {
      renderPanel({
        onPublishCredentialsChange: vi.fn(),
        labels: {
          credentialsLabel: 'Partager mes identifiants',
          credentialsHint: 'Les membres ne devront pas se connecter.',
        },
      });
      expect(screen.getByText('Partager mes identifiants')).toBeTruthy();
      expect(
        screen.getByText('Les membres ne devront pas se connecter.'),
      ).toBeTruthy();
    });

    it('reflects the current value', () => {
      renderPanel({
        publishCredentials: true,
        onPublishCredentialsChange: vi.fn(),
      });
      expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe(
        'true',
      );
    });

    it('reports the negated value on toggle and holds no state of its own', async () => {
      const onPublishCredentialsChange = vi.fn();
      renderPanel({ publishCredentials: false, onPublishCredentialsChange });

      await userEvent.click(screen.getByRole('checkbox'));

      expect(onPublishCredentialsChange).toHaveBeenCalledWith(true);
      /* Controlled: the panel still renders what the host passed. */
      expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe(
        'false',
      );
    });

    it('is disabled while a publish request is in flight', () => {
      renderPanel({
        isSubmitting: true,
        onPublishCredentialsChange: vi.fn(),
      });
      const checkbox = screen.getByRole('checkbox');
      expect(
        checkbox.hasAttribute('disabled') ||
          checkbox.getAttribute('aria-disabled') === 'true',
      ).toBe(true);
    });

    /* The consequence of ticking must be in the description, not the label alone. */
    it('wires the caption as the checkbox accessible description', () => {
      renderPanel({
        onPublishCredentialsChange: vi.fn(),
        labels: {
          credentialsHint: 'Members will use this without signing in.',
        },
      });

      const checkbox = screen.getByRole('checkbox');
      const caption = screen.getByText(
        'Members will use this without signing in.',
      );
      expect(caption.id).toBeTruthy();
      expect(checkbox.getAttribute('aria-describedby')).toContain(caption.id);
    });
  });

  it('renders the folder section title', () => {
    renderPanel();
    expect(screen.getByText('Publish to folder')).toBeTruthy();
  });

  it('forwards the translated folder-creation cancel label', async () => {
    renderPanel({
      view: PublishPanelView.ChangeFolder,
      labels: { cancelCreatingFolderLabel: 'Discard folder' },
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Create new folder' }),
    );

    expect(screen.getByRole('button', { name: 'Discard folder' })).toBeTruthy();
  });

  describe('destination row', () => {
    it('shows the placeholder and a Choose action while no folder is selected', () => {
      renderPanel();

      const row = screen.getByRole('group', { name: 'Destination folder' });
      expect(row.textContent).toBe('No folder selected');
      expect(screen.getByRole('button', { name: 'Choose' })).toBeTruthy();
    });

    it('shows the full path under the root label once a folder is selected', () => {
      renderPanel({ selectedFolderPath: ['Shared', 'Data Science'] });

      expect(
        screen.getByRole('group', { name: 'Destination folder' }).textContent,
      ).toContain('Organization / Shared / Data Science');
      expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();
    });

    it('calls onChangeFolderClick when the action is pressed', async () => {
      const onChangeFolderClick = vi.fn();
      renderPanel({ onChangeFolderClick });

      await userEvent.click(screen.getByRole('button', { name: 'Choose' }));

      expect(onChangeFolderClick).toHaveBeenCalledOnce();
    });

    it('renders no folder tree or search in the main view', () => {
      renderPanel();

      expect(screen.queryByRole('search')).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Create new folder' }),
      ).toBeNull();
    });
  });

  describe('folder view', () => {
    it('renders the search and the tree without the form fields', () => {
      renderPanel({ view: PublishPanelView.ChangeFolder });

      expect(
        screen.getByRole('group', { name: 'Publish to folder' }),
      ).toBeTruthy();
      expect(screen.getByRole('search')).toBeTruthy();
      expect(screen.getByText('Shared')).toBeTruthy();
      expect(screen.queryByRole('textbox', { name: /Author/ })).toBeNull();
      expect(screen.queryByText('Allow access if all match')).toBeNull();
    });

    it('moves focus into the folder view and back to the action on return', () => {
      const { rerender } = renderPanel();
      const props = {
        resource,
        folderItems,
        onChangeFolderClick: vi.fn(),
        onPendingFolderPathChange: vi.fn(),
        onCreateFolder: vi.fn(),
        hasExistingPublicationInFolder: false,
        hasWriteAccess: true,
        isSubmitting: false,
        author: '',
        onAuthorChange: vi.fn(),
        rules: [],
        onRulesChange: vi.fn(),
        ruleSourceOptions: [],
      };

      rerender(
        <PublishPanel {...props} view={PublishPanelView.ChangeFolder} />,
      );
      expect(
        screen
          .getByRole('group', { name: 'Publish to folder' })
          .matches(':focus'),
      ).toBe(true);

      rerender(<PublishPanel {...props} view={PublishPanelView.Main} />);
      expect(
        screen.getByRole('button', { name: 'Choose' }).matches(':focus'),
      ).toBe(true);
    });
  });

  it('renders the access-rules section inside the folder block', () => {
    renderPanel({ selectedFolderPath: ['Shared', 'Data Science'] });
    expect(screen.getByText('Allow access if all match')).toBeTruthy();
  });

  it('scopes the access-rules hint to the selected folder', () => {
    renderPanel({ selectedFolderPath: ['Shared', 'Data Science'] });
    expect(
      screen.getByText(/These rules apply to "Data Science"/),
    ).toBeTruthy();
  });

  it('uses the root folder label in the access-rules hint when the root is selected', () => {
    renderPanel({ selectedFolderPath: [] });
    expect(
      screen.getByText(/These rules apply to "Organization"/),
    ).toBeTruthy();
  });

  it('prompts for a destination folder in the access-rules hint when none is selected', () => {
    renderPanel();
    expect(
      screen.getByText(/pick a folder above to set its rules/),
    ).toBeTruthy();
  });

  it('renders existing rules as chips and forwards removals via onRulesChange', async () => {
    const onRulesChange = vi.fn();
    renderPanel({
      rules: [
        {
          source: 'role',
          function: PublicationRuleFunction.Contain,
          targets: ['engineering'],
        },
      ],
      onRulesChange,
    });

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove rule for role: engineering',
      }),
    );

    expect(onRulesChange).toHaveBeenCalledWith([]);
  });

  it('shows the replace-warning callout when the version already exists in the folder, with the folder name bold', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science', 'Published models'],
      hasExistingPublicationInFolder: true,
    });
    expect(
      screen.getByText('is already published in', { exact: false }),
    ).toBeTruthy();
    expect(
      screen.getByText('Publishing will replace it.', { exact: false }),
    ).toBeTruthy();
    const boldFolderNames = screen
      .getAllByText('Published models')
      .filter((el) => el.tagName === 'STRONG');
    expect(boldFolderNames).toHaveLength(1);
  });

  it('shows the no-access callout when the user lacks write access, with the folder name bold', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
      hasWriteAccess: false,
    });
    expect(
      screen.getByText("don't have permission to publish to", {
        exact: false,
      }),
    ).toBeTruthy();
    const boldFolderNames = screen
      .getAllByText('Data Science')
      .filter((el) => el.tagName === 'STRONG');
    expect(boldFolderNames).toHaveLength(1);
  });

  it('shows the submit-error callout when the most recent submit attempt failed', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
      hasSubmitError: true,
    });
    expect(
      screen.getByText('Publishing failed. Please try again.'),
    ).toBeTruthy();
  });

  it('shows the admin-approval banner for a fresh folder the user can publish to', () => {
    renderPanel({ selectedFolderPath: ['Shared', 'Data Science'] });
    expect(screen.getByText('Admin approval required')).toBeTruthy();
    expect(screen.getByText(/We’ll send a request/)).toBeTruthy();
  });

  it('takes the admin-approval banner text from labels', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
      labels: {
        adminApprovalTitle: 'Custom title',
        adminApprovalMessage: 'Your application will appear in the folder.',
      },
    });
    expect(screen.getByText('Custom title')).toBeTruthy();
    expect(
      screen.getByText('Your application will appear in the folder.'),
    ).toBeTruthy();
  });

  it.each([
    ['no folder is selected', {}],
    [
      'the version already exists',
      {
        selectedFolderPath: ['Shared'],
        hasExistingPublicationInFolder: true,
      },
    ],
    [
      'the user lacks write access',
      { selectedFolderPath: ['Shared'], hasWriteAccess: false },
    ],
    [
      'the last submit failed',
      { selectedFolderPath: ['Shared'], hasSubmitError: true },
    ],
  ])('hides the admin-approval banner when %s', (_, props) => {
    renderPanel(props);
    expect(screen.queryByText('Admin approval required')).toBeNull();
  });

  it('hides the callout while submitting', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
      isSubmitting: true,
    });
    expect(screen.queryByText(/Everyone with access/)).toBeNull();
  });

  describe('root selection', () => {
    it('uses the root folder label in the no-access callout when the root is selected', () => {
      const { container } = renderPanel({
        selectedFolderPath: [],
        hasWriteAccess: false,
      });
      expect(container.textContent).toContain(
        "You don't have permission to publish to Organization. Pick another, or ask an owner for access.",
      );
    });

    it('uses a custom rootFolderLabel text override', () => {
      const { container } = renderPanel({
        selectedFolderPath: [],
        hasWriteAccess: false,
        labels: { rootFolderLabel: 'Public bucket' },
      });
      expect(container.textContent).toContain(
        "You don't have permission to publish to Public bucket.",
      );
    });
  });
  describe('author field', () => {
    it('renders with the default English label, placeholder and hint', () => {
      renderPanel();

      const field = screen.getByRole('textbox', { name: /Author/ });
      expect(field.getAttribute('placeholder')).toBe('Author name');
      expect(
        screen.getByText(
          'Shown as the publication’s author. Defaults to you — replace it to credit a team instead.',
        ),
      ).toBeTruthy();
    });

    it('renders the supplied author value', () => {
      renderPanel({ author: 'DIAL Team' });

      expect(screen.getByRole('textbox', { name: /Author/ })).toHaveProperty(
        'value',
        'DIAL Team',
      );
    });

    it('calls onAuthorChange as the user types', async () => {
      const onAuthorChange = vi.fn();
      renderPanel({ onAuthorChange });

      await userEvent.type(
        screen.getByRole('textbox', { name: /Author/ }),
        'D',
      );

      expect(onAuthorChange).toHaveBeenCalledWith('D');
    });

    it('caps the field at the backend author limit', () => {
      renderPanel();

      expect(
        screen
          .getByRole('textbox', { name: /Author/ })
          .getAttribute('maxlength'),
      ).toBe('200');
    });

    it('disables the field while a publish request is in flight', () => {
      renderPanel({ isSubmitting: true });

      expect(
        (screen.getByRole('textbox', { name: /Author/ }) as HTMLInputElement)
          .disabled,
      ).toBe(true);
    });

    it('applies label overrides from the labels prop', () => {
      renderPanel({
        labels: {
          authorLabel: 'Автор',
          authorPlaceholder: 'Имя автора',
          authorHint: 'Кто стоит за публикацией',
        },
      });

      const field = screen.getByRole('textbox', { name: /Автор/ });
      expect(field.getAttribute('placeholder')).toBe('Имя автора');
      expect(screen.getByText('Кто стоит за публикацией')).toBeTruthy();
    });

    it('renders between the destination folder section and the access rules', () => {
      const { container } = renderPanel();
      const text = container.textContent ?? '';

      expect(text.indexOf('Publish to folder')).toBeLessThan(
        text.indexOf('Author'),
      );
      expect(text.indexOf('Author')).toBeLessThan(
        text.indexOf('Allow access if all match'),
      );
    });
  });
});

describe('PublishPanel — public class names', () => {
  it('stamps the panel body', () => {
    const { container } = renderPanel();

    /* The body carries no role of its own; it is the rendered root, so the
       container's first element child is the element under test. */
    // eslint-disable-next-line testing-library/no-node-access -- see above
    expect(container.firstElementChild!.classList).toContain(
      PUBLISH_PANEL_CLASS.panel,
    );
  });
});

describe('PublishPanel — private dependencies', () => {
  const dependencies = [
    {
      id: 'prompts/b/Greeting',
      name: 'Greeting',
      type: PublishDependencyType.Prompt,
      location: 'Support',
    },
    {
      id: 'toolsets/b/Search__1.0.0',
      name: 'Search',
      version: '1.0.0',
      type: PublishDependencyType.Toolset,
      location: '',
    },
  ];

  it('lists the dependencies as the last section of the panel', () => {
    renderPanel({ dependencies });

    const region = screen.getByRole('region', { name: 'Private dependencies' });
    const folderHeading = screen.getByRole('heading', {
      name: 'Publish to folder',
    });
    expect(
      folderHeading.compareDocumentPosition(region) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Greeting')).toBeTruthy();
    expect(screen.getByText('Search')).toBeTruthy();
  });

  it('renders no section for an empty list', () => {
    renderPanel({ dependencies: [] });

    expect(
      screen.queryByRole('region', { name: 'Private dependencies' }),
    ).toBeNull();
  });

  it('renders no section when no list is supplied', () => {
    renderPanel();

    expect(
      screen.queryByRole('region', { name: 'Private dependencies' }),
    ).toBeNull();
  });

  it('shows host labels passed through the panel labels', () => {
    renderPanel({
      dependencies,
      labels: { dependenciesLabels: { title: 'Not public yet' } },
    });

    expect(screen.getByRole('region', { name: 'Not public yet' })).toBeTruthy();
  });

  it('does not render the section in the folder view', () => {
    renderPanel({ dependencies, view: PublishPanelView.ChangeFolder });

    expect(
      screen.queryByRole('region', { name: 'Private dependencies' }),
    ).toBeNull();
  });
});
