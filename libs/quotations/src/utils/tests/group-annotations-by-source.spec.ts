import type { Annotation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  gatherSameSourceAnnotations,
  groupAnnotations,
  groupAnnotationsByCitId,
  groupAnnotationsBySource,
} from '../group-annotations-by-source';

const makeAnnotation = (url: string): Annotation => ({
  body: {
    source: {
      type: 'attachment',
      attachment: { type: 'application/pdf', url },
    },
  },
});

const makeCitAnnotation = (id: string, url: string): Annotation => ({
  target: { selector: { type: 'html_tag', tag: 'cit', id } },
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

  it('sets groupKey equal to sourceUrl', () => {
    const url = 'https://files.example.com/report.pdf';
    const groups = groupAnnotationsBySource([makeAnnotation(url)]);
    expect(groups[0].groupKey).toBe(url);
  });

  it('excludes html_tag annotations', () => {
    const groups = groupAnnotationsBySource([
      makeCitAnnotation('e1', 'https://files.example.com/report.pdf'),
    ]);
    expect(groups).toHaveLength(0);
  });
});

describe('groupAnnotationsByCitId', () => {
  it('produces two groups for two cit ids sharing the same source URL', () => {
    const url = 'https://files.example.com/report.pdf';
    const groups = groupAnnotationsByCitId([
      makeCitAnnotation('e43864', url),
      makeCitAnnotation('e52dc2', url),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.groupKey)).toEqual(['cit:e43864', 'cit:e52dc2']);
    expect(groups[0].sourceUrl).toBe(url);
    expect(groups[1].sourceUrl).toBe(url);
  });

  it('groups two annotations sharing the same cit id into one group', () => {
    const url = 'https://files.example.com/report.pdf';
    const groups = groupAnnotationsByCitId([
      makeCitAnnotation('e1', url),
      makeCitAnnotation('e1', url),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].annotations).toHaveLength(2);
  });

  it('excludes non-html_tag annotations', () => {
    const groups = groupAnnotationsByCitId([
      makeAnnotation('https://files.example.com/report.pdf'),
    ]);
    expect(groups).toHaveLength(0);
  });
});

describe('groupAnnotations', () => {
  it('returns both group families for a mixed annotation list', () => {
    const url = 'https://files.example.com/report.pdf';
    const groups = groupAnnotations([
      makeAnnotation(url),
      makeCitAnnotation('e1', url),
      makeCitAnnotation('e2', url),
    ]);
    expect(groups).toHaveLength(3);
    expect(groups.filter((g) => g.groupKey.startsWith('cit:'))).toHaveLength(2);
    expect(groups.filter((g) => g.groupKey === url)).toHaveLength(1);
  });

  it('returns an empty array for an empty input', () => {
    expect(groupAnnotations([])).toEqual([]);
  });
});

describe('gatherSameSourceAnnotations', () => {
  it('never merges two annotations sharing a title but differing in URL', () => {
    const reportA = makeCitAnnotation('a', 'files/a/report.docx');
    const reportB = makeCitAnnotation('b', 'files/b/report.docx');

    const result = gatherSameSourceAnnotations(reportA, [reportA, reportB]);

    expect(result).toEqual([reportA]);
    expect(result).not.toContain(reportB);
  });

  it('returns three html_tag annotations with distinct cit ids, two citing one file, excluding the third', () => {
    const url = 'files/a/report.docx';
    const first = makeCitAnnotation('e1', url);
    const second = makeCitAnnotation('e2', url);
    const other = makeCitAnnotation('e3', 'files/b/other.docx');

    const result = gatherSameSourceAnnotations(first, [first, second, other]);

    expect(result).toEqual([first, second]);
  });

  it('returns four annotations for one URL in original order with the clicked one identifiable by reference', () => {
    const url = 'files/a/report.docx';
    const annotations = [
      makeCitAnnotation('e1', url),
      makeCitAnnotation('e2', url),
      makeCitAnnotation('e3', url),
      makeCitAnnotation('e4', url),
    ];

    const result = gatherSameSourceAnnotations(annotations[2], annotations);

    expect(result).toEqual(annotations);
    expect(result[2]).toBe(annotations[2]);
  });

  it('returns the clicked annotation alone when absent from the supplied list', () => {
    const url = 'files/a/report.docx';
    const clicked = makeCitAnnotation('e1', url);
    const other = makeCitAnnotation('e2', url);

    const result = gatherSameSourceAnnotations(clicked, [other]);

    expect(result).toEqual([clicked]);
  });
});
