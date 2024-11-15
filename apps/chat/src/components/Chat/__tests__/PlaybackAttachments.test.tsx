import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { PlaybackAttachments } from '../Playback/PlaybackAttachments';

import { Attachment } from '@epam/ai-dial-shared';

vi.mock('@/src/utils/app/file', () => {
  return {
    getDialFilesFromAttachments: vi
      .fn()
      .mockImplementation((attachments: Attachment[]) => {
        const files = attachments.map((attachment) => {
          return {
            id: attachment.url ?? attachment.title,
            name: attachment.title,
            contentType: attachment.type,
            absolutePath: attachment.url,
          };
        });
        return files;
      }),
    getDialFoldersFromAttachments: vi.fn().mockReturnValue([]),
    getDialLinksFromAttachments: vi.fn().mockReturnValue([]),
  };
});

describe('<PlaybackAttachments />', () => {
  const fakeData = [
    {
      title: 'TEST1_FILE.txt',
      url: 'url/TEST1_FILE.txt',
      type: 'binary/octet-stream',
    },
    {
      title: 'TEST2_FILE.txt',
      url: 'url/TEST2_FILE.txt',
      type: 'binary/octet-stream',
    },
    {
      title: 'TEST3_FILE.txt',
      url: 'url/TEST3_FILE.txt',
      type: 'binary/octet-stream',
    },
  ];

  beforeEach(() => {
    vi.resetModules();
  });

  it('renders all elements with correct titles', () => {
    render(<PlaybackAttachments attachments={fakeData} />);

    fakeData.forEach((item) => {
      const element = screen.getByText(item.title);
      expect(element).toBeInTheDocument();
    });
  });

  it('do not renders any of elements with title', () => {
    render(<PlaybackAttachments attachments={[]} />);

    fakeData.forEach((item) => {
      const element = screen.queryByText(item.title);
      expect(element).not.toBeInTheDocument();
    });
  });
});
