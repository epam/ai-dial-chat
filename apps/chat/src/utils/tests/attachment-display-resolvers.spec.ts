import type { MessageAttachment } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { attachmentDisplayResolvers } from '../attachment-display-resolvers';

const audio = (url: string): MessageAttachment => ({
  type: 'audio/mpeg',
  url,
  title: 'clip.mp3',
});

describe('attachmentDisplayResolvers', () => {
  describe('resolvePlayUrl', () => {
    it('plays a DIAL file through the files download endpoint', () => {
      expect(
        attachmentDisplayResolvers.resolvePlayUrl?.(
          audio('files/a1b2c3/clips/clip.mp3'),
        ),
      ).toBe('/api/v1/files/download?bucket=a1b2c3&path=clips%2Fclip.mp3');
    });

    it('plays a generated project file through the project artifact endpoint', () => {
      expect(
        attachmentDisplayResolvers.resolvePlayUrl?.(
          audio('projects/a1b2c3/Q4%20launch/files/artifacts/clip.mp3'),
        ),
      ).toBe(
        '/api/v1/projects/projects%2Fa1b2c3%2FQ4%20launch/artifacts/clip.mp3',
      );
    });
  });
});
