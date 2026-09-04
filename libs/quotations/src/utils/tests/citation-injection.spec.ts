import type { Annotation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { AnnotationGroup } from '../group-annotations-by-source';
import {
  injectCitationSentinels,
  stripCitTagsWhileStreaming,
} from '../citation-injection';

const makeOffsetGroup = (end: number): AnnotationGroup => {
  const annotation: Annotation = {
    target: { selector: { type: 'text_character_range', start: 0, end } },
    body: {
      source: {
        type: 'attachment',
        attachment: { type: 'application/pdf', url: 'files/report.pdf' },
      },
    },
  };
  return {
    groupKey: 'files/report.pdf',
    sourceUrl: 'files/report.pdf',
    sourceName: 'report.pdf',
    annotations: [annotation],
    primaryAnnotation: annotation,
  };
};

const makeCitGroup = (id: string): AnnotationGroup => {
  const annotation: Annotation = {
    target: { selector: { type: 'html_tag', tag: 'cit', id } },
    body: {
      source: {
        type: 'attachment',
        attachment: { type: 'application/pdf', url: 'files/doc.pdf' },
      },
    },
  };
  return {
    groupKey: `cit:${id}`,
    sourceUrl: 'files/doc.pdf',
    sourceName: 'doc.pdf',
    annotations: [annotation],
    primaryAnnotation: annotation,
  };
};

describe('injectCitationSentinels — offset-based', () => {
  it('injects a sentinel at the character offset', () => {
    const result = injectCitationSentinels('The revenue was $1B.', [
      makeOffsetGroup(19),
    ]);
    expect(result).toBe('The revenue was $1B⟦C0⟧.');
  });

  it('clamps an out-of-range offset to the end of content', () => {
    const result = injectCitationSentinels('Short', [makeOffsetGroup(100)]);
    expect(result).toBe('Short⟦C0⟧');
  });

  it('leaves content unchanged when there are no groups', () => {
    const result = injectCitationSentinels('plain text', []);
    expect(result).toBe('plain text');
  });

  it('skips html_tag groups — those render as real <cit> elements instead, not sentinels', () => {
    const content = 'before<cit data-id="e1"></cit>after';
    const result = injectCitationSentinels(content, [makeCitGroup('e1')]);
    expect(result).toBe(content);
  });

  it('preserves the original flat-array index for the offset group when an html_tag group precedes it', () => {
    const result = injectCitationSentinels('The revenue was $1B.', [
      makeCitGroup('e1'),
      makeOffsetGroup(19),
    ]);
    expect(result).toBe('The revenue was $1B⟦C1⟧.');
  });
});

describe('stripCitTagsWhileStreaming', () => {
  it('leaves content unchanged when there is no cit tag', () => {
    expect(stripCitTagsWhileStreaming('plain text')).toBe('plain text');
  });

  it('removes a complete cit element entirely', () => {
    const content =
      'The patient meets criteria<cit data-id="e43864"></cit>, and the plan is X.';
    expect(stripCitTagsWhileStreaming(content)).toBe(
      'The patient meets criteria, and the plan is X.',
    );
  });

  it('removes two complete cit elements', () => {
    const content =
      'First<cit data-id="e1"></cit> middle<cit data-id="e2"></cit> last';
    expect(stripCitTagsWhileStreaming(content)).toBe('First middle last');
  });

  it('hides a dangling open tag and everything streamed after it', () => {
    const content =
      'The patient meets criteria<cit data-id="e438">and the plan is still streaming in';
    expect(stripCitTagsWhileStreaming(content)).toBe(
      'The patient meets criteria',
    );
  });

  it('hides an incomplete opening tag fragment at the end of the buffer', () => {
    const content = 'The patient meets criteria<cit data-id="e4';
    expect(stripCitTagsWhileStreaming(content)).toBe(
      'The patient meets criteria',
    );
  });
});
