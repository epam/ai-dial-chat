import type {
  ApplicationVisualizer,
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  findVisualizerForApplication,
  findVisualizerForMime,
  partitionAttachmentsForApplicationVisualizer,
} from '../visualizer';

const makeVisualizer = (
  contentType: string,
  overrides?: Partial<CustomVisualizer>,
): CustomVisualizer => ({
  title: 'my-viz',
  description: 'test viz',
  icon: 'icon.svg',
  contentType,
  url: 'https://viz.example.com',
  requestTimeout: 5000,
  ...overrides,
});

describe('findVisualizerForMime', () => {
  it('matches a single-entry contentType list case-insensitively', () => {
    const visualizer = makeVisualizer('application/pdf');

    expect(findVisualizerForMime('application/PDF', [visualizer])).toBe(
      visualizer,
    );
  });

  it('matches against a comma-separated contentType list', () => {
    const visualizer = makeVisualizer('text/plain,application/pdf');

    expect(findVisualizerForMime('application/pdf', [visualizer])).toBe(
      visualizer,
    );
  });

  it('matches a MIME type from the middle of a comma-separated list', () => {
    const visualizer = makeVisualizer(
      'application/x-foo, application/x-my-viz, application/x-bar',
    );

    expect(findVisualizerForMime('application/x-my-viz', [visualizer])).toBe(
      visualizer,
    );
  });

  it('trims whitespace around comma-separated entries', () => {
    const visualizer = makeVisualizer('  application/pdf  ,  text/plain  ');

    expect(findVisualizerForMime('application/pdf', [visualizer])).toBe(
      visualizer,
    );
  });

  it('returns the first match when multiple entries cover the same MIME type', () => {
    const first = makeVisualizer('application/pdf', { title: 'first' });
    const second = makeVisualizer('application/pdf', { title: 'second' });

    expect(findVisualizerForMime('application/pdf', [first, second])).toBe(
      first,
    );
  });

  it('returns undefined when no visualizer matches', () => {
    const visualizer = makeVisualizer('application/pdf');

    expect(findVisualizerForMime('application/json', [visualizer])).toBe(
      undefined,
    );
  });

  it('returns undefined for an empty registry', () => {
    expect(findVisualizerForMime('application/pdf', [])).toBe(undefined);
  });

  it('ignores an empty contentType entry produced by a trailing comma', () => {
    const visualizer = makeVisualizer('application/pdf,');

    expect(findVisualizerForMime('', [visualizer])).toBe(undefined);
  });
});

const makeAppVisualizer = (
  overrides?: Partial<ApplicationVisualizer>,
): ApplicationVisualizer => ({
  title: 'my-viz',
  url: 'https://viz.example.com',
  ...overrides,
});

const makeAttachment = (
  contentType: string,
  overrides?: Partial<DisplayAttachment>,
): DisplayAttachment =>
  ({
    id: contentType,
    name: contentType,
    contentType,
    type: AttachmentType.File,
    url: `files/bucket/path/${contentType}`,
    ...overrides,
  }) as DisplayAttachment;

describe('findVisualizerForApplication', () => {
  it('returns the entry registered under the exact application id', () => {
    const entry = makeAppVisualizer();

    expect(findVisualizerForApplication('app-1', { 'app-1': entry })).toBe(
      entry,
    );
  });

  it('returns undefined when the application id is absent from the registry', () => {
    expect(
      findVisualizerForApplication('app-2', { 'app-1': makeAppVisualizer() }),
    ).toBe(undefined);
  });

  it('does not normalise the key — case and whitespace must match exactly', () => {
    const registry = { 'app-1': makeAppVisualizer() };

    expect(findVisualizerForApplication('APP-1', registry)).toBe(undefined);
    expect(findVisualizerForApplication(' app-1', registry)).toBe(undefined);
  });

  it('returns undefined for an undefined or empty application id', () => {
    const registry = { 'app-1': makeAppVisualizer() };

    expect(findVisualizerForApplication(undefined, registry)).toBe(undefined);
    expect(findVisualizerForApplication('', registry)).toBe(undefined);
  });

  it('returns undefined for an empty registry', () => {
    expect(findVisualizerForApplication('app-1', {})).toBe(undefined);
  });

  it('ignores inherited Object.prototype keys', () => {
    expect(findVisualizerForApplication('toString', {})).toBe(undefined);
  });
});

describe('partitionAttachmentsForApplicationVisualizer', () => {
  it('claims only the MIME types the entry lists', () => {
    const claimedAttachment = makeAttachment('application/x-my-viz');
    const otherAttachment = makeAttachment('image/png');

    const result = partitionAttachmentsForApplicationVisualizer(
      [claimedAttachment, otherAttachment],
      makeAppVisualizer({ contentType: 'application/x-my-viz' }),
    );

    expect(result.claimed).toEqual([claimedAttachment]);
    expect(result.unclaimed).toEqual([otherAttachment]);
  });

  it('matches a comma-separated contentType list case-insensitively', () => {
    const first = makeAttachment('application/x-a');
    const second = makeAttachment('APPLICATION/X-B');

    const result = partitionAttachmentsForApplicationVisualizer(
      [first, second],
      makeAppVisualizer({ contentType: 'application/x-a, application/x-b' }),
    );

    expect(result.claimed).toEqual([first, second]);
    expect(result.unclaimed).toEqual([]);
  });

  it('claims every URL attachment when contentType is omitted', () => {
    const withUrl = makeAttachment('image/png');
    const inlineOnly = makeAttachment('text/plain', {
      url: undefined,
      data: 'aGk=',
    });

    const result = partitionAttachmentsForApplicationVisualizer(
      [withUrl, inlineOnly],
      makeAppVisualizer(),
    );

    expect(result.claimed).toEqual([withUrl]);
    expect(result.unclaimed).toEqual([inlineOnly]);
  });

  it('does not claim a listed MIME type that has no url', () => {
    const inlineOnly = makeAttachment('application/x-my-viz', {
      url: undefined,
      data: 'aGk=',
    });

    const result = partitionAttachmentsForApplicationVisualizer(
      [inlineOnly],
      makeAppVisualizer({ contentType: 'application/x-my-viz' }),
    );

    expect(result.claimed).toEqual([]);
    expect(result.unclaimed).toEqual([inlineOnly]);
  });

  it('does not claim a reference-only attachment', () => {
    const referenceOnly = makeAttachment('text/markdown', {
      url: undefined,
      referenceUrl: 'https://example.com/source',
    });

    const result = partitionAttachmentsForApplicationVisualizer(
      [referenceOnly],
      makeAppVisualizer(),
    );

    expect(result.claimed).toEqual([]);
    expect(result.unclaimed).toEqual([referenceOnly]);
  });

  it('claims nothing when no attachment matches the declared list', () => {
    const attachments = [makeAttachment('image/png')];

    const result = partitionAttachmentsForApplicationVisualizer(
      attachments,
      makeAppVisualizer({ contentType: 'application/x-my-viz' }),
    );

    expect(result.claimed).toEqual([]);
    expect(result.unclaimed).toEqual(attachments);
  });

  it('preserves the input order on both sides', () => {
    const a = makeAttachment('application/x-a', { id: 'a' });
    const b = makeAttachment('image/png', { id: 'b' });
    const c = makeAttachment('application/x-a', { id: 'c' });
    const d = makeAttachment('image/png', { id: 'd' });

    const result = partitionAttachmentsForApplicationVisualizer(
      [a, b, c, d],
      makeAppVisualizer({ contentType: 'application/x-a' }),
    );

    expect(result.claimed.map((item) => item.id)).toEqual(['a', 'c']);
    expect(result.unclaimed.map((item) => item.id)).toEqual(['b', 'd']);
  });

  it('treats a whitespace-only contentType as no declared list', () => {
    const withUrl = makeAttachment('image/png');

    const result = partitionAttachmentsForApplicationVisualizer(
      [withUrl],
      makeAppVisualizer({ contentType: ' , ' }),
    );

    expect(result.claimed).toEqual([withUrl]);
  });

  it('returns two empty sides for an empty attachment list', () => {
    const result = partitionAttachmentsForApplicationVisualizer(
      [],
      makeAppVisualizer(),
    );

    expect(result).toEqual({ claimed: [], unclaimed: [] });
  });
});
