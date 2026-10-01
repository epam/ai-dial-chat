import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FileDeleteConfirmContent from '../FileDeleteConfirmContent';

const renderContent = (names: string[]) =>
  render(<FileDeleteConfirmContent names={names} />);

describe('FileDeleteConfirmContent', () => {
  it('names a single item by its basename, not its path', () => {
    renderContent(['files/bucket/reports/Q3 summary.pdf']);

    expect(screen.getByText('Q3 summary.pdf')).toBeTruthy();
    expect(screen.queryByText(/files\/bucket/)).toBeNull();
  });

  it('states the consequence for a single item', () => {
    renderContent(['notes.txt']);

    /* The suite-wide i18n mock renders keys. */
    expect(
      screen.getByText('dialFileManager.deleteConfirmMessageSingle'),
    ).toBeTruthy();
    expect(screen.getByRole('listitem').textContent).toBe(
      'basic.consequenceCannotBeUndone',
    );
  });

  it('lists every selected name when there are several', () => {
    renderContent(['a/one.txt', 'b/two.txt', 'c/three.txt']);

    expect(
      screen.getByText('dialFileManager.deleteConfirmMessageMultiple'),
    ).toBeTruthy();
    expect(screen.getByText('one.txt')).toBeTruthy();
    expect(screen.getByText('two.txt')).toBeTruthy();
    expect(screen.getByText('three.txt')).toBeTruthy();
  });

  it('caps the list and counts the rest, so a long selection cannot push the actions away', () => {
    renderContent(
      Array.from({ length: 14 }, (_, index) => `folder/file-${index}.txt`),
    );

    expect(screen.getByText('file-9.txt')).toBeTruthy();
    expect(screen.queryByText('file-10.txt')).toBeNull();
    expect(
      screen.getByText('dialFileManager.deleteConfirmMoreItems'),
    ).toBeTruthy();
  });

  it('omits the rest row when the selection fits', () => {
    renderContent(['one.txt', 'two.txt']);

    expect(
      screen.queryByText('dialFileManager.deleteConfirmMoreItems'),
    ).toBeNull();
  });
});
