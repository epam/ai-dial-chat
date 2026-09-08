import type { Annotation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  escapeUnsupportedCitTags,
  injectCitationSentinels,
  stripCitTagsWhileStreaming,
} from '../citation-injection';
import type { AnnotationGroup } from '../group-annotations-by-source';

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

  it('renders a dangling open tag and the streamed suffix as text', () => {
    const content =
      'The patient meets criteria<cit data-id="e438">and the plan is still streaming in';
    expect(stripCitTagsWhileStreaming(content)).toBe(
      'The patient meets criteria&lt;cit data-id="e438"&gt;and the plan is still streaming in',
    );
  });

  it('renders an incomplete opening tag fragment as text', () => {
    const content = 'The patient meets criteria<cit data-id="e4';
    expect(stripCitTagsWhileStreaming(content)).toBe(
      'The patient meets criteria&lt;cit data-id="e4',
    );
  });

  it('renders unsupported differently-cased markup as text while streaming', () => {
    expect(stripCitTagsWhileStreaming('<CIT data-id="e1"></CIT>')).toBe(
      '&lt;CIT data-id="e1"&gt;&lt;/CIT&gt;',
    );
  });
});

describe('escapeUnsupportedCitTags', () => {
  it('keeps the supported empty paired data-id element parseable', () => {
    const content = 'before<cit data-id="e1"></cit>after';
    expect(escapeUnsupportedCitTags(content)).toBe(content);
  });

  it('escapes an id tag instead of interpreting it as a citation', () => {
    expect(escapeUnsupportedCitTags('<cit id="e1"></cit>')).toBe(
      '&lt;cit id="e1"&gt;&lt;/cit&gt;',
    );
  });

  it('escapes a data-id element containing text', () => {
    expect(escapeUnsupportedCitTags('<cit data-id="e1">visible</cit>')).toBe(
      '&lt;cit data-id="e1"&gt;visible&lt;/cit&gt;',
    );
  });

  it('escapes differently-cased cit markup instead of treating it as supported', () => {
    expect(escapeUnsupportedCitTags('<CIT data-id="e1"></CIT>')).toBe(
      '&lt;CIT data-id="e1"&gt;&lt;/CIT&gt;',
    );
  });
});
