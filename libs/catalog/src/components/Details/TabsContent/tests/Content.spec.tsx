import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  CatalogContentFilePreview,
  CatalogContentTreeNode,
} from '../../../../models/item-details-data';
import { CatalogContentNodeType } from '../../../../types/catalog-content-node-type';
import { CatalogContentPreviewType } from '../../../../types/catalog-content-preview-type';
import { ContentTab, type ContentTabProps } from '../Content';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  InlineSelectTrigger: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  Dropdown: ({
    children,
    open,
    renderOverlay,
  }: {
    children: ReactNode;
    open?: boolean;
    renderOverlay?: () => ReactNode;
  }) => (
    <div>
      {children}
      {open && renderOverlay?.()}
    </div>
  ),
}));
vi.mock('@tabler/icons-react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tabler/icons-react')>()),
  IconChevronDown: () => <svg />,
  IconFolder: () => <svg />,
}));

/** Wraps `ContentTab` with local state so the fully-controlled selector props behave interactively in tests. */
const ControlledContentTab = (props: ContentTabProps) => {
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(
    props.isFileSelectorOpen ?? false,
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(props.expandedFolderIds ?? []),
  );

  return (
    <ContentTab
      {...props}
      isFileSelectorOpen={isFileSelectorOpen}
      onFileSelectorOpenChange={setIsFileSelectorOpen}
      expandedFolderIds={expandedFolderIds}
      onToggleFolder={(folderId) =>
        setExpandedFolderIds((prev) => {
          const next = new Set(prev);
          if (next.has(folderId)) {
            next.delete(folderId);
          } else {
            next.add(folderId);
          }
          return next;
        })
      }
    />
  );
};

describe('ContentTab', () => {
  it('renders the body as markdown', () => {
    render(
      <ContentTab content={'## Instructions\n\n- first step\n- second step'} />,
    );

    expect(screen.getByRole('heading', { name: 'Instructions' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders the description above the body when present', () => {
    render(
      <ContentTab content="Summarize:" description="Writes a short summary." />,
    );

    expect(screen.getByText('Writes a short summary.')).toBeTruthy();
  });

  it('separates the description from the body with a divider', () => {
    const { container } = render(
      <ContentTab content="Summarize:" description="Writes a short summary." />,
    );

    // The divider is a bare styled div with no role/text; only a CSS-class
    // check can detect it.
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('[class*="divider"]')).toBeTruthy();
  });

  it('omits the description block when it is empty', () => {
    const { container } = render(<ContentTab content="Summarize:" />);

    // Counting bare <p> elements and checking for the divider class are
    // CSS-level checks with no semantic query available.
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelectorAll('p')).toHaveLength(1);
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('[class*="divider"]')).toBeNull();
  });

  it('highlights a {{placeholder}} apart from the surrounding prose', () => {
    render(<ContentTab content="Reply to {{original_email}} politely." />);

    const variable = screen.getByText('{{original_email}}');
    expect(variable.tagName).toBe('SPAN');
    expect(variable.className).toContain('cat-prompt-variable');
  });

  it('leaves a placeholder inside a code fence unhighlighted', () => {
    render(<ContentTab content={'```\n{{original_email}}\n```'} />);

    expect(
      screen.queryByText(
        (_, element) =>
          element?.className?.includes?.('cat-prompt-variable') ?? false,
      ),
    ).toBeNull();
  });

  it('scrolls the body inside its own container rather than the page', () => {
    render(<ContentTab content="a very long prompt body" />);

    const body = screen.getByText('a very long prompt body');
    /* The markdown paragraph sits inside the scroll container. The scroll
     * container is a bare div with no role, so checking ancestry via its
     * CSS class is the only way to verify this layout detail. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(body.closest('.overflow-auto')).toBeTruthy();
  });

  it('renders no copy control', () => {
    render(<ContentTab content="Summarize:" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ContentTab — file selector', () => {
  const file = (id: string, name = id): CatalogContentTreeNode => ({
    type: CatalogContentNodeType.File,
    id,
    name,
  });
  const folder = (
    id: string,
    items: CatalogContentTreeNode[],
    name = id,
  ): CatalogContentTreeNode => ({
    type: CatalogContentNodeType.Folder,
    id,
    name,
    items,
  });

  const flatFiles: CatalogContentTreeNode[] = [
    file('SKILL.md'),
    file('analyzer.md'),
  ];
  const nestedFiles: CatalogContentTreeNode[] = [
    file('SKILL.md'),
    folder('scripts', [file('scripts/run.py', 'run.py')]),
  ];

  it('renders no selector when the item carries no files', () => {
    render(<ContentTab content="Body" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  /* One file, at any depth, is the body itself — a selector with a single option is noise. */
  it('renders no selector for exactly one file nested inside two folders', () => {
    render(
      <ContentTab
        content="Body"
        files={[folder('a', [folder('b', [file('a/b/only.md', 'only.md')])])]}
        selectedFileId="a/b/only.md"
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('1 files')).toBeNull();
  });

  it('renders the selector and the file count, counting files only, not folders', () => {
    render(
      <ContentTab
        content="Body"
        files={nestedFiles}
        selectedFileId="SKILL.md"
      />,
    );

    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.getByText('2 files')).toBeTruthy();
  });

  it('shows the open file basename on the trigger', () => {
    render(
      <ContentTab
        content="Body"
        files={nestedFiles}
        selectedFileId="scripts/run.py"
      />,
    );

    expect(screen.getByRole('button').textContent).toContain('run.py');
  });

  it('shows and selects a nested base file whose opaque id is a prefixed path', async () => {
    const manifestId = 'hello-with-file/files/SKILL.md';
    const files = [
      folder('hello-with-file', [
        folder('hello-with-file/files', [
          file(manifestId, 'SKILL.md'),
          file('hello-with-file/files/notes.md', 'notes.md'),
        ]),
      ]),
    ];
    render(
      <ControlledContentTab
        content="Instructions"
        files={files}
        selectedFileId={manifestId}
        expandedFolderIds={
          new Set(['hello-with-file', 'hello-with-file/files'])
        }
      />,
    );

    expect(screen.getByRole('button').textContent).toContain('SKILL.md');

    await userEvent.click(screen.getByRole('button'));

    expect(
      screen
        .getByRole('treeitem', { name: 'SKILL.md' })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('uses the supplied file-count label', () => {
    render(
      <ContentTab
        content="Body"
        files={flatFiles}
        selectedFileId="SKILL.md"
        fileCountLabel={(count) => `${count} файла`}
      />,
    );

    expect(screen.getByText('2 файла')).toBeTruthy();
  });

  it('opening the selector reveals a collapsed folder without its children', async () => {
    render(
      <ControlledContentTab
        content="Body"
        files={nestedFiles}
        selectedFileId="SKILL.md"
      />,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('scripts')).toBeTruthy();
    expect(screen.queryByText('run.py')).toBeNull();
  });

  it('expanding a folder reveals its children', async () => {
    render(
      <ControlledContentTab
        content="Body"
        files={nestedFiles}
        selectedFileId="SKILL.md"
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('scripts'));

    expect(screen.getByText('run.py')).toBeTruthy();
  });

  it('still renders an empty folder, expandable but revealing no children', async () => {
    render(
      <ControlledContentTab
        content="Body"
        files={[file('SKILL.md'), folder('empty', []), file('other.md')]}
        selectedFileId="SKILL.md"
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('empty')).toBeTruthy();

    await userEvent.click(screen.getByText('empty'));
    expect(screen.getByText('empty')).toBeTruthy();
  });

  it('calls onSelectFile with a nested file id unchanged', async () => {
    const onSelectFile = vi.fn();
    render(
      <ControlledContentTab
        content="Body"
        files={nestedFiles}
        selectedFileId="SKILL.md"
        onSelectFile={onSelectFile}
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('scripts'));
    await userEvent.click(screen.getByText('run.py'));

    expect(onSelectFile).toHaveBeenCalledWith('scripts/run.py');
  });

  it('closes the selector once a file is picked', async () => {
    render(
      <ControlledContentTab
        content="Body"
        files={flatFiles}
        selectedFileId="SKILL.md"
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('analyzer.md'));

    expect(screen.queryByText('analyzer.md')).toBeNull();
  });

  it('announces a loading file through a status region', () => {
    render(
      <ContentTab
        content=""
        files={flatFiles}
        selectedFileId="analyzer.md"
        isFileLoading
        fileLoadingLabel="Loading file"
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Loading file');
  });

  it('announces nothing once the file has loaded', () => {
    render(
      <ContentTab
        content="Body"
        files={flatFiles}
        selectedFileId="analyzer.md"
      />,
    );

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('ContentTab — file preview', () => {
  it('renders a host-owned preview surface ahead of the built-in preview types', () => {
    const preview: CatalogContentFilePreview = {
      type: CatalogContentPreviewType.Text,
      text: 'built-in preview',
    };
    render(
      <ContentTab
        content="Base"
        filePreview={preview}
        filePreviewContent={<div>Attachment canvas preview</div>}
      />,
    );

    expect(screen.getByText('Attachment canvas preview')).toBeTruthy();
    expect(screen.queryByText('built-in preview')).toBeNull();
  });

  it('renders a markdown preview through the safe markdown path', () => {
    const preview: CatalogContentFilePreview = {
      type: CatalogContentPreviewType.Markdown,
      text: '## Notes\n\nSee it.',
    };
    render(<ContentTab content="Base" filePreview={preview} />);

    expect(screen.getByRole('heading', { name: 'Notes' })).toBeTruthy();
  });

  it('renders a text preview as read-only code, with the download control hidden', () => {
    const preview: CatalogContentFilePreview = {
      type: CatalogContentPreviewType.Text,
      text: 'def f():\n    return 1',
      language: 'python',
    };
    const { container } = render(
      <ContentTab content="Base" filePreview={preview} />,
    );

    /* Syntax highlighting splits the code into per-token <span> elements, so
     * only the container's combined text content can be matched. */

    expect(container.textContent).toContain('def f():');
    expect(screen.queryByLabelText('Download code')).toBeNull();
  });

  it('renders an image preview with alt text from the selected file name', () => {
    const files: CatalogContentTreeNode[] = [
      { type: CatalogContentNodeType.File, id: 'SKILL.md', name: 'SKILL.md' },
      { type: CatalogContentNodeType.File, id: 'logo.png', name: 'logo.png' },
    ];
    const preview: CatalogContentFilePreview = {
      type: CatalogContentPreviewType.Image,
      url: 'blob:mock-url',
    };
    render(
      <ContentTab
        content="Base"
        files={files}
        selectedFileId="logo.png"
        filePreview={preview}
      />,
    );

    const image = screen.getByRole('img') as HTMLImageElement;
    expect(image.src).toContain('blob:mock-url');
    expect(image.alt).toBe('logo.png');
  });

  it('renders the unsupported label without attempting to decode content', () => {
    const preview: CatalogContentFilePreview = {
      type: CatalogContentPreviewType.Unsupported,
    };
    render(
      <ContentTab
        content="Base"
        filePreview={preview}
        fileUnsupportedLabel="Preview is not supported for this file"
      />,
    );

    expect(
      screen.getByText('Preview is not supported for this file'),
    ).toBeTruthy();
  });

  it('renders the base content as markdown when no preview is picked', () => {
    render(<ContentTab content="## Base heading" />);

    expect(screen.getByRole('heading', { name: 'Base heading' })).toBeTruthy();
  });

  it('renders a blank body while loading, regardless of a stale preview', () => {
    const preview: CatalogContentFilePreview = {
      type: CatalogContentPreviewType.Markdown,
      text: '## Stale',
    };
    render(
      <ContentTab
        content="Base"
        filePreview={preview}
        isFileLoading
        fileLoadingLabel="Loading file"
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Stale' })).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Loading file');
  });
});
