import { describe, expect, it } from 'vitest';
import type { AdmissionLog } from '../../env-admission/admission-log';
import { admitAnnouncements } from '../../env-admission/announcements.admission';
import {
  admitContentLocales,
  isLegacyContentLocalesInEffect,
} from '../../env-admission/content-locales.admission';
import { admitCustomVariables } from '../../env-admission/custom-variables.admission';
import {
  FILE_MANAGER_ALLOWED_TABS,
  admitFileManagerTabs,
} from '../../env-admission/file-manager-tabs.admission';
import { admitPublicationFilterSources } from '../../env-admission/publication-filter-sources.admission';
import {
  admitApplicationVisualizers,
  admitCustomVisualizers,
} from '../../env-admission/visualizers.admission';

const recordingLog = () => {
  const messages: string[] = [];
  const log: AdmissionLog = {
    warn: (message) => messages.push(`warn: ${message}`),
    error: (message) => messages.push(`error: ${message}`),
  };
  return { log, messages };
};

describe('admitAnnouncements', () => {
  it.each([undefined, ''])('resolves %j to undefined silently', (raw) => {
    const { log, messages } = recordingLog();
    expect(admitAnnouncements(raw, log)).toBeUndefined();
    expect(messages).toEqual([]);
  });

  it('returns the parsed array without validating entries', () => {
    const { log, messages } = recordingLog();
    expect(admitAnnouncements('[{"title":" "},"text"]', log)).toEqual([
      { title: ' ' },
      'text',
    ]);
    expect(messages).toEqual([]);
  });

  it.each([
    [
      '[{',
      'error: ANNOUNCEMENTS is not valid JSON; resolving to an empty list',
    ],
    [
      '{"title":"A"}',
      'error: ANNOUNCEMENTS must be a JSON array; resolving to an empty list',
    ],
  ])('rejects %j with an error', (raw, message) => {
    const { log, messages } = recordingLog();
    expect(admitAnnouncements(raw, log)).toBeUndefined();
    expect(messages).toEqual([message]);
  });
});

describe('admitCustomVariables', () => {
  it.each([undefined, '', '   '])(
    'resolves %j to undefined silently',
    (raw) => {
      const { log, messages } = recordingLog();
      expect(admitCustomVariables(raw, log)).toBeUndefined();
      expect(messages).toEqual([]);
    },
  );

  it('returns a JSON object as is', () => {
    const { log } = recordingLog();
    expect(admitCustomVariables('{"a":1,"b":{"c":[null]}}', log)).toEqual({
      a: 1,
      b: { c: [null] },
    });
  });

  it.each(['{invalid', '[]', 'null', '42', '"text"'])(
    'warns without the payload for %j',
    (raw) => {
      const { log, messages } = recordingLog();
      expect(admitCustomVariables(raw, log)).toBeUndefined();
      expect(messages).toEqual([
        'warn: CUSTOM_CLIENT_VARIABLES must be a JSON object; using an empty object',
      ]);
    },
  );
});

describe('admitCustomVisualizers', () => {
  it.each([undefined, ''])('resolves %j to undefined', (raw) => {
    const { log } = recordingLog();
    expect(admitCustomVisualizers(raw, log)).toBeUndefined();
  });

  it('keeps valid entries and drops invalid ones independently', () => {
    const { log, messages } = recordingLog();
    const raw = JSON.stringify([
      42,
      { title: '', contentType: 'text/x', url: 'https://a.example.com' },
      { title: 'Viz', contentType: ' , ', url: 'https://b.example.com' },
      {
        title: 'Viz',
        contentType: 'text/x',
        url: 'https://c.example.com',
        development: true,
      },
    ]);

    expect(admitCustomVisualizers(raw, log)).toEqual([
      { title: 'Viz', contentType: 'text/x', url: 'https://c.example.com' },
    ]);
    expect(messages).toEqual([
      'error: CUSTOM_VISUALIZERS[0] is not an object; dropping entry',
      'error: CUSTOM_VISUALIZERS[1] failed validation, dropping entry: title should not be empty',
      'error: CUSTOM_VISUALIZERS[2] has no usable MIME type in "contentType"; dropping entry',
      'warn: CUSTOM_VISUALIZERS[3] contains unrecognized fields that will be ignored: development',
    ]);
  });

  it.each([
    [
      '[{',
      'error: CUSTOM_VISUALIZERS is not valid JSON; resolving to an empty registry',
    ],
    [
      '{}',
      'error: CUSTOM_VISUALIZERS must be a JSON array; resolving to an empty registry',
    ],
  ])('resolves %j to an empty registry', (raw, message) => {
    const { log, messages } = recordingLog();
    expect(admitCustomVisualizers(raw, log)).toEqual([]);
    expect(messages).toEqual([message]);
  });
});

describe('admitApplicationVisualizers', () => {
  const allowed = ['https://viz.example.com'];

  it.each([undefined, ''])('resolves %j to undefined', (raw) => {
    const { log } = recordingLog();
    expect(admitApplicationVisualizers(raw, allowed, log)).toBeUndefined();
  });

  it('keeps valid entries and warns about an origin missing from the iframe allow-list', () => {
    const { log, messages } = recordingLog();
    const raw = JSON.stringify({
      a: 42,
      b: { title: '', url: 'https://b.example.com' },
      c: { title: 'Viz', url: 'https://viz.example.com', contentType: ' , ' },
      d: { title: 'Viz', url: 'https://other.example.org', expanded: true },
      e: { title: 'Viz', url: 'https://viz.example.com', borderless: true },
    });

    expect(admitApplicationVisualizers(raw, allowed, log)).toEqual({
      d: { title: 'Viz', url: 'https://other.example.org' },
      e: { title: 'Viz', url: 'https://viz.example.com', borderless: true },
    });
    expect(messages).toEqual([
      'error: APPLICATION_VISUALIZERS["a"] is not an object; dropping entry',
      'error: APPLICATION_VISUALIZERS["b"] failed validation, dropping entry: title should not be empty',
      'error: APPLICATION_VISUALIZERS["c"] has no usable MIME type in "contentType"; dropping entry',
      'warn: APPLICATION_VISUALIZERS["d"] contains unrecognized fields that will be ignored: expanded',
      'warn: APPLICATION_VISUALIZERS["d"] points at https://other.example.org, which is not listed in ALLOWED_IFRAME_ORIGINS; the browser will block the iframe unless that URL is same-origin with the app',
    ]);
  });

  it('builds a prototype-less registry', () => {
    const { log } = recordingLog();
    const result = admitApplicationVisualizers(
      '{"__proto__":{"title":"Viz","url":"https://viz.example.com"}}',
      allowed,
      log,
    );
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it.each([
    [
      '{',
      'error: APPLICATION_VISUALIZERS is not valid JSON; resolving to an empty registry',
    ],
    [
      '[]',
      'error: APPLICATION_VISUALIZERS must be a JSON object keyed by application id; resolving to an empty registry',
    ],
  ])('resolves %j to an empty registry', (raw, message) => {
    const { log, messages } = recordingLog();
    expect(admitApplicationVisualizers(raw, allowed, log)).toEqual({});
    expect(messages).toEqual([message]);
  });
});

describe('admitFileManagerTabs', () => {
  it.each([undefined, [], ['nope', 'other']])(
    'resolves %j to undefined',
    (tabs) => {
      expect(admitFileManagerTabs(tabs)).toBeUndefined();
    },
  );

  it('keeps the known ids in their configured order', () => {
    expect(admitFileManagerTabs(['shared', 'nope', 'all'])).toEqual([
      'shared',
      'all',
    ]);
  });

  it('allows exactly the four client tabs', () => {
    expect(FILE_MANAGER_ALLOWED_TABS).toEqual([
      'all',
      'my_files',
      'shared',
      'organization',
    ]);
  });
});

describe('admitPublicationFilterSources', () => {
  it.each([undefined, []])('resolves %j to undefined', (sources) => {
    expect(admitPublicationFilterSources(sources)).toBeUndefined();
  });

  it('returns the configured sources', () => {
    expect(admitPublicationFilterSources(['title', 'department'])).toEqual([
      'title',
      'department',
    ]);
  });
});

describe('admitContentLocales', () => {
  it('resolves both absent to undefined', () => {
    expect(admitContentLocales(undefined, undefined)).toBeUndefined();
    expect(isLegacyContentLocalesInEffect(undefined, undefined)).toBe(false);
  });

  it('canonicalises and de-duplicates the new list', () => {
    expect(admitContentLocales(['de-de', 'fr', 'de-DE'], undefined)).toEqual([
      'de-DE',
      'fr',
    ]);
  });

  it('lets a present new list win, even when empty', () => {
    expect(admitContentLocales([], ['de'])).toEqual([]);
    expect(isLegacyContentLocalesInEffect([], ['de'])).toBe(false);
  });

  it('reads the legacy list, stripping its decoration, only when the new one is absent', () => {
    expect(admitContentLocales(undefined, '["ar","en"]')).toEqual(['ar', 'en']);
    expect(isLegacyContentLocalesInEffect(undefined, '["ar","en"]')).toBe(true);
  });
});
