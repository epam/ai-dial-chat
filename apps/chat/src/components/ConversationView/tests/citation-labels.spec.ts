import type { Annotation, AnnotationSelector } from '@epam/ai-dial-chat-shared';
import type { AnnotationGroup } from '@epam/ai-dial-quotations';
import i18next, { type TFunction } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '../../../i18n/locales/en.json';
import { buildCitationMarkerLabels } from '../utils/citation-labels';

const makeGroup = (
  sourceName: string,
  selector?: AnnotationSelector,
  annotationCount = 1,
): AnnotationGroup => {
  const annotation: Annotation = {
    body: {
      selector,
      source: {
        type: 'attachment',
        attachment: { type: 'application/pdf', url: 'files/b/clm.pdf' },
      },
    },
  };
  return {
    groupKey: 'cit:00000',
    sourceUrl: 'files/b/clm.pdf',
    sourceName,
    annotations: Array.from({ length: annotationCount }, () => annotation),
    primaryAnnotation: annotation,
  };
};

const pageSelector = (page: number): AnnotationSelector => ({
  type: 'pdf_bbox',
  page,
  x1: 0,
  y1: 0,
  x2: 10,
  y2: 10,
});

describe('buildCitationMarkerLabels', () => {
  let t: TFunction;

  beforeAll(async () => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: 'en',
      resources: { en: { translation: en } },
      interpolation: { escapeValue: false },
    });
    t = instance.t;
  });

  it.each([
    [
      'names the cited page in the label and the accessible name',
      {
        source: 'clm.pdf',
        page: 5,
        expected: {
          ariaLabel: 'Citation from clm.pdf, page 5',
          label: 'clm.pdf, p. 5',
          labelWithOverflow: 'clm.pdf, p. 5 +0',
        },
      },
    ],
    [
      'leaves page 1 out of the label, as a link to the whole document',
      {
        source: 'clm.pdf',
        page: 1,
        expected: {
          ariaLabel: 'Citation from clm.pdf',
          label: 'clm.pdf',
          labelWithOverflow: 'clm.pdf +0',
        },
      },
    ],
    [
      'does not repeat a page the source name already mentions',
      {
        source: 'clm.pdf, page 3',
        page: 3,
        expected: {
          ariaLabel: 'Citation from clm.pdf, page 3',
          label: 'clm.pdf, page 3',
          labelWithOverflow: 'clm.pdf, page 3 +0',
        },
      },
    ],
  ])('%s', (_name, { source, page, expected }) => {
    expect(
      buildCitationMarkerLabels(t, makeGroup(source, pageSelector(page))),
    ).toEqual(expected);
  });

  it('keeps the page alongside the overflow count', () => {
    expect(
      buildCitationMarkerLabels(t, makeGroup('clm.pdf', pageSelector(2), 3))
        .labelWithOverflow,
    ).toBe('clm.pdf, p. 2 +2');
  });

  it('shows the source name only when no page is known', () => {
    expect(buildCitationMarkerLabels(t, makeGroup('clm.pdf')).label).toBe(
      'clm.pdf',
    );
  });
});
