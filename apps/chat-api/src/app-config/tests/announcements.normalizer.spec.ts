import { describe, expect, it, vi } from 'vitest';
import { normalizeAnnouncements } from '../announcements.normalizer';

describe('normalizeAnnouncements', () => {
  it('returns an empty list with no warning when the value is absent', () => {
    const warn = vi.fn();
    expect(normalizeAnnouncements(undefined, warn)).toEqual([]);
    expect(normalizeAnnouncements(null, warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a warning and returns an empty list when the value is not an array', () => {
    const warn = vi.fn();
    const result = normalizeAnnouncements({ title: 'x' }, warn);
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      'ANNOUNCEMENTS did not resolve to an array; ignoring it',
    );
  });

  it('returns a complete announcement entry', () => {
    const warn = vi.fn();
    const result = normalizeAnnouncements(
      [
        {
          title: 'We have upgraded to DIAL 1.43',
          description: "Check what's new:",
          link: { label: 'Changelog', href: 'https://dialx.ai' },
        },
      ],
      warn,
    );

    expect(result).toEqual([
      {
        title: 'We have upgraded to DIAL 1.43',
        description: "Check what's new:",
        link: { label: 'Changelog', href: 'https://dialx.ai' },
      },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps an announcement that carries no link', () => {
    const result = normalizeAnnouncements(
      [{ title: 'Maintenance window on Friday' }],
      vi.fn(),
    );
    expect(result).toEqual([
      { title: 'Maintenance window on Friday', description: null, link: null },
    ]);
  });

  it.each([
    ['javascript:alert(1)'],
    ['data:text/html,x'],
    ['/settings'],
    ['not a url'],
    ['JaVaScRiPt:alert(1)'],
  ])('drops an announcement whose link href is %s', (href) => {
    const warn = vi.fn();
    const result = normalizeAnnouncements(
      [{ title: 'Bad link', link: { label: 'Go', href } }],
      warn,
    );
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`Ignoring announcement "Bad link"`),
    );
  });

  it('drops an announcement whose link label is blank', () => {
    const warn = vi.fn();
    const result = normalizeAnnouncements(
      [{ title: 'No label', link: { label: '  ', href: 'https://x.dev' } }],
      warn,
    );
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'Ignoring announcement "No label": link.label is blank or missing',
    );
  });

  it('drops an announcement with a blank or missing title', () => {
    const warn = vi.fn();
    const result = normalizeAnnouncements(
      [{ title: '   ' }, { description: 'orphan' }],
      warn,
    );
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      'Ignoring announcement entry with a blank or missing title',
    );
  });

  it('drops a non-object entry with the exact warning text', () => {
    const warn = vi.fn();
    const result = normalizeAnnouncements(['not-an-object'], warn);
    expect(result).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'Ignoring announcement entry that is not an object',
    );
  });

  it('keeps the valid announcements when one entry is rejected', () => {
    const result = normalizeAnnouncements(
      [
        { title: 'Good', link: { label: 'Go', href: 'https://x.dev' } },
        { title: 'Bad', link: { label: 'Go', href: 'javascript:x' } },
      ],
      vi.fn(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Good');
  });

  it('preserves the configured order of announcements', () => {
    const result = normalizeAnnouncements(
      [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }],
      vi.fn(),
    );
    expect(result.map((item) => item.title)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('preserves duplicate announcements rather than deduplicating them', () => {
    const entry = {
      title: 'Same announcement',
      description: 'Same body',
      link: { label: 'Go', href: 'https://x.dev' },
    };
    const result = normalizeAnnouncements([entry, { ...entry }], vi.fn());
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(result[1]);
  });

  it('does not treat title or link label as markup', () => {
    const result = normalizeAnnouncements(
      [
        {
          title: 'Release <b>3.0</b>',
          link: { label: 'See <i>details</i>', href: 'https://x.dev' },
        },
      ],
      vi.fn(),
    );
    expect(result[0].title).toBe('Release <b>3.0</b>');
    expect(result[0].link?.label).toBe('See <i>details</i>');
  });

  describe('description sanitization', () => {
    it('strips scripts, images, and inline handlers but keeps safe text', () => {
      const result = normalizeAnnouncements(
        [
          {
            title: 'Heads up',
            description:
              'Hi<script>alert(1)</script><img src=x onerror="alert(1)">',
          },
        ],
        vi.fn(),
      );
      const description = result[0].description ?? '';
      expect(description).not.toContain('<script');
      expect(description).not.toContain('<img');
      expect(description).not.toContain('onerror');
      expect(description).toContain('Hi');
    });

    it('returns null when the description sanitizes away entirely', () => {
      const result = normalizeAnnouncements(
        [{ title: 'Heads up', description: '<script>alert(1)</script>' }],
        vi.fn(),
      );
      expect(result[0].description).toBeNull();
    });

    it('returns null when the description is blank', () => {
      const result = normalizeAnnouncements(
        [{ title: 'Heads up', description: '   ' }],
        vi.fn(),
      );
      expect(result[0].description).toBeNull();
    });

    it('preserves safe markup in the description', () => {
      const result = normalizeAnnouncements(
        [
          {
            title: 'Heads up',
            description: 'Explore our <strong>AI offerings</strong>.',
          },
        ],
        vi.fn(),
      );
      expect(result[0].description).toBe(
        'Explore our <strong>AI offerings</strong>.',
      );
    });

    it('forces external description links to open safely', () => {
      const result = normalizeAnnouncements(
        [
          {
            title: 'Heads up',
            description: '<a href="https://dialx.ai">docs</a>',
          },
        ],
        vi.fn(),
      );
      const description = result[0].description ?? '';
      expect(description).toContain('target="_blank"');
      expect(description).toContain('rel="noopener noreferrer"');
    });

    it('leaves hash-link anchors untouched', () => {
      const result = normalizeAnnouncements(
        [
          {
            title: 'Heads up',
            description: '<a href="#section">jump</a>',
          },
        ],
        vi.fn(),
      );
      const description = result[0].description ?? '';
      expect(description).not.toContain('target="_blank"');
      expect(description).toContain('href="#section"');
    });
  });

  describe('cap behavior', () => {
    it('caps the returned list at 10 and keeps entries in order', () => {
      const entries = Array.from({ length: 15 }, (_, index) => ({
        title: `Announcement ${index}`,
      }));
      const warn = vi.fn();
      const result = normalizeAnnouncements(entries, warn);

      expect(result).toHaveLength(10);
      expect(result[0].title).toBe('Announcement 0');
      expect(result[9].title).toBe('Announcement 9');
      expect(warn).toHaveBeenCalledWith(
        'ANNOUNCEMENTS carried 15 entries; keeping the first 10 and dropping the rest',
      );
    });

    it('logs an invalid entry beyond the cap before the cap-exceeded warning, using the total valid count', () => {
      const validEntries = Array.from({ length: 12 }, (_, index) => ({
        title: `Announcement ${index}`,
      }));
      const warn = vi.fn();
      const result = normalizeAnnouncements(
        [...validEntries, { title: '   ' }],
        warn,
      );

      expect(result).toHaveLength(10);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenNthCalledWith(
        1,
        'Ignoring announcement entry with a blank or missing title',
      );
      expect(warn).toHaveBeenNthCalledWith(
        2,
        'ANNOUNCEMENTS carried 12 entries; keeping the first 10 and dropping the rest',
      );
    });

    it('does not stop processing once 10 valid entries have been accumulated', () => {
      const entries = [
        ...Array.from({ length: 10 }, (_, index) => ({
          title: `Announcement ${index}`,
        })),
        { title: '   ' },
        { title: 'Announcement 11' },
      ];
      const warn = vi.fn();
      const result = normalizeAnnouncements(entries, warn);

      expect(result).toHaveLength(10);
      expect(result[9].title).toBe('Announcement 9');
      expect(warn).toHaveBeenCalledWith(
        'Ignoring announcement entry with a blank or missing title',
      );
      expect(warn).toHaveBeenCalledWith(
        'ANNOUNCEMENTS carried 11 entries; keeping the first 10 and dropping the rest',
      );
    });
  });

  describe('immutability', () => {
    it('does not mutate the input array or its entry/link objects', () => {
      const input = [
        {
          title: 'Immutable',
          description: 'Body',
          link: { label: 'Go', href: 'https://x.dev' },
        },
      ];
      const snapshot = JSON.parse(JSON.stringify(input));

      const result = normalizeAnnouncements(input, vi.fn());

      expect(input).toEqual(snapshot);
      expect(result[0]).not.toBe(input[0]);
      expect(result[0].link).not.toBe(input[0].link);
    });
  });
});
