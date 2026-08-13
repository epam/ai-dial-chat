import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContentTab } from '../Content';

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

    expect(container.querySelector('[class*="divider"]')).toBeTruthy();
  });

  it('omits the description block when it is empty', () => {
    const { container } = render(<ContentTab content="Summarize:" />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
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
    /* The markdown paragraph sits inside the scroll container. */
    expect(body.closest('.overflow-auto')).toBeTruthy();
  });

  it('renders no copy control', () => {
    render(<ContentTab content="Summarize:" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ContentTab — file picker', () => {
  const files = [
    { id: 'SKILL.md', name: 'SKILL.md' },
    { id: 'analyzer.md', name: 'analyzer.md' },
  ];

  it('renders no picker when the item carries no files', () => {
    render(<ContentTab content="Body" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  /* One file is the body itself — a picker with a single option is noise. */
  it('renders no picker for a single file', () => {
    render(
      <ContentTab
        content="Body"
        files={[files[0]]}
        selectedFileId="SKILL.md"
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('1 files')).toBeNull();
  });

  it('renders the picker and the file count for several files', () => {
    render(
      <ContentTab content="Body" files={files} selectedFileId="SKILL.md" />,
    );

    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.getByText('2 files')).toBeTruthy();
  });

  it('opens on the selected file', () => {
    render(
      <ContentTab content="Body" files={files} selectedFileId="analyzer.md" />,
    );

    expect(screen.getByRole('button').textContent).toContain('analyzer.md');
  });

  it('uses the supplied file-count label', () => {
    render(
      <ContentTab
        content="Body"
        files={files}
        selectedFileId="SKILL.md"
        fileCountLabel={(count) => `${count} файла`}
      />,
    );

    expect(screen.getByText('2 файла')).toBeTruthy();
  });

  it('calls onSelectFile with the picked file id', async () => {
    const onSelectFile = vi.fn();
    render(
      <ContentTab
        content="Body"
        files={files}
        selectedFileId="SKILL.md"
        onSelectFile={onSelectFile}
      />,
    );

    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByText('analyzer.md'));

    expect(onSelectFile).toHaveBeenCalledWith('analyzer.md');
  });

  it('announces a loading file through a status region', () => {
    render(
      <ContentTab
        content=""
        files={files}
        selectedFileId="analyzer.md"
        isFileLoading
        fileLoadingLabel="Loading file"
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('Loading file');
  });

  it('announces nothing once the file has loaded', () => {
    render(
      <ContentTab content="Body" files={files} selectedFileId="analyzer.md" />,
    );

    expect(screen.queryByRole('status')).toBeNull();
  });
});
