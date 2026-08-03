import type { Annotation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { groupAnnotationsBySource } from '../group-annotations-by-source';

const makeAnnotation = (url: string): Annotation => ({
  body: {
    source: {
      type: 'attachment',
      attachment: { type: 'application/pdf', url },
    },
  },
});

describe('groupAnnotationsBySource', () => {
  it('groups two annotations with the same URL into one group', () => {
    const url = 'https://files.example.com/report.pdf';
    const groups = groupAnnotationsBySource([
      makeAnnotation(url),
      makeAnnotation(url),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].annotations).toHaveLength(2);
    expect(groups[0].sourceUrl).toBe(url);
  });

  it('creates two groups for two different URLs', () => {
    const groups = groupAnnotationsBySource([
      makeAnnotation('https://files.example.com/a.pdf'),
      makeAnnotation('https://files.example.com/b.pdf'),
    ]);
    expect(groups).toHaveLength(2);
  });

  it('derives sourceName from the last URL path segment', () => {
    const groups = groupAnnotationsBySource([
      makeAnnotation('https://files.example.com/path/to/report.pdf'),
    ]);
    expect(groups[0].sourceName).toBe('report.pdf');
  });

  it('falls back to hostname when the URL path has no filename segment', () => {
    const groups = groupAnnotationsBySource([
      makeAnnotation('https://wikipedia.org/'),
    ]);
    expect(groups[0].sourceName).toBe('wikipedia.org');
  });

  it('excludes annotations without a source URL', () => {
    const groups = groupAnnotationsBySource([
      { body: { title: 'no source' } },
      makeAnnotation('https://files.example.com/doc.pdf'),
    ]);
    expect(groups).toHaveLength(1);
  });

  it('returns an empty array for an empty input', () => {
    expect(groupAnnotationsBySource([])).toEqual([]);
  });

  it('sets primaryAnnotation to the first annotation in the group', () => {
    const url = 'https://files.example.com/report.pdf';
    const first = makeAnnotation(url);
    const second = makeAnnotation(url);
    const groups = groupAnnotationsBySource([first, second]);
    expect(groups[0].primaryAnnotation).toBe(first);
  });
});
