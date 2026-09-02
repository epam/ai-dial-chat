import type { Annotation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { AnnotationGroup } from '../group-annotations-by-source';
import { injectCitationSentinels } from '../citation-injection';

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

describe('injectCitationSentinels — offset-based (regression)', () => {
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
});

describe('injectCitationSentinels — tag-based (cit id)', () => {
  it('replaces two matched cit tags with their sentinels, no raw tag text remains', () => {
    const content =
      'The patient meets all criteria for permanent implantation<cit id="e43864">, and the plan is to proceed with the Stage 2 implantation of a Medtronic InterStim X implantable pulse generator<cit id="e52dc2">.';
    const groups = [makeCitGroup('e43864'), makeCitGroup('e52dc2')];
    const result = injectCitationSentinels(content, groups);

    expect(result).not.toContain('<cit');
    expect(result).toBe(
      'The patient meets all criteria for permanent implantation⟦C0⟧, and the plan is to proceed with the Stage 2 implantation of a Medtronic InterStim X implantable pulse generator⟦C1⟧.',
    );
  });

  it('strips an unmatched cit tag instead of leaving it as raw text', () => {
    const content = 'See the note<cit id="unknown-id">.';
    const result = injectCitationSentinels(content, []);
    expect(result).toBe('See the note.');
    expect(result).not.toContain('<cit');
  });

  it('strips a trailing incomplete tag fragment', () => {
    const content = 'permanent implantation<cit id="e4';
    const result = injectCitationSentinels(content, []);
    expect(result).toBe('permanent implantation');
  });

  it('leaves content unchanged when there is no cit tag and no groups', () => {
    const result = injectCitationSentinels('plain text', []);
    expect(result).toBe('plain text');
  });
});
