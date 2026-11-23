import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalSha256 } from '../../managed-config/canonical-json';
import { PINNED_MANAGED_CONFIG_SCHEMA_SHA256 } from '../../managed-config/managed-config.constants';
import { ManagedRejectionReason } from '../../managed-runtime/managed-runtime.types';
import {
  acceptSnapshot,
  compileManagedPayloadValidators,
  type AcceptanceContext,
} from '../../managed-runtime/snapshot-acceptance';
import { snapshotBody } from './managed-runtime.fixtures';

const validators = compileManagedPayloadValidators();

const chatUiSchemaArtifact100 = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '../../../../managed-config-schema/ai-dial-chat-1.0.0.json',
    ),
    'utf8',
  ),
) as { appId: string; schemaVersion: string; schema: Record<string, unknown> };

const chatContext = (
  overrides: Partial<AcceptanceContext> = {},
): AcceptanceContext => ({
  appId: 'ai-dial-chat',
  instanceId: 'chat-dev',
  knownRevision: () => undefined,
  validators,
  ...overrides,
});

const HINT = { id: 'tour.start', target: 'new-chat', title: 'Start here' };

const VALID_PAYLOAD = {
  config: {
    'onboarding.hints': [
      { ...HINT, description: 'Each chat keeps its own history.' },
      { id: 'tour.composer', target: 'conversation-input', title: 'Ask' },
    ],
  },
  features: {},
};

/* A 1.0.0 envelope, for the snapshots published before the upgrade. */
const V100 = {
  schemaVersion: '1.0.0',
  schemaSha256: PINNED_MANAGED_CONFIG_SCHEMA_SHA256['1.0.0'],
};

/* A 1.1.0 envelope: announcements and celebrations, no managed feature. */
const V110 = {
  schemaVersion: '1.1.0',
  schemaSha256: PINNED_MANAGED_CONFIG_SCHEMA_SHA256['1.1.0'],
};

const tour = (...hints: unknown[]) => ({
  config: { 'onboarding.hints': hints },
  features: {},
});

const rejectionOf = (body: unknown, context = chatContext()) => {
  const result = acceptSnapshot(body, context);
  return result.accepted ? undefined : result.reason;
};

describe('acceptSnapshot', () => {
  it('accepts a valid ai-dial-chat snapshot as a frozen copy', () => {
    const body = snapshotBody({ payload: VALID_PAYLOAD });
    const result = acceptSnapshot(body, chatContext());

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.snapshot.revisionId).toBe(body['revisionId']);
    expect(result.snapshot.payload).toEqual(VALID_PAYLOAD);
    expect(result.snapshot.payload).not.toBe(body['payload']);
    expect(result.snapshot.payloadSha256).toBe(canonicalSha256(VALID_PAYLOAD));
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.payload['config'])).toBe(true);
    expect(() => {
      (result.snapshot.payload['config'] as Record<string, unknown>)[
        'onboarding.hints'
      ] = [];
    }).toThrow(TypeError);
  });

  it('rejects a snapshot of another instance', () => {
    expect(rejectionOf(snapshotBody({ instanceId: 'chat-prod' }))).toBe(
      ManagedRejectionReason.IdentityMismatch,
    );
  });

  it('rejects a snapshot of another application', () => {
    expect(rejectionOf(snapshotBody({ appId: 'launchpad' }))).toBe(
      ManagedRejectionReason.IdentityMismatch,
    );
  });

  /* The legacy identifier is an alias for requests and the environment only:
   * an instance created with appId chat-ui publishes another contract line. */
  it('rejects a snapshot published under the legacy chat-ui identifier', () => {
    expect(rejectionOf(snapshotBody({ appId: 'chat-ui' }))).toBe(
      ManagedRejectionReason.IdentityMismatch,
    );
  });

  it('rejects a snapshot of another environment when one is configured', () => {
    expect(
      rejectionOf(
        snapshotBody({ environment: 'prod' }),
        chatContext({ environment: 'dev' }),
      ),
    ).toBe(ManagedRejectionReason.IdentityMismatch);
  });

  it.each([
    ['a non-object body', []],
    ['a non-semver schema version', snapshotBody({ schemaVersion: 'v1' })],
    ['an uppercase hash', snapshotBody({ sha256: 'A'.repeat(64) })],
    ['an empty revision ID', snapshotBody({ revisionId: '' })],
    ['a long revision ID', snapshotBody({ revisionId: 'r'.repeat(129) })],
    [
      'a non-instant publication time',
      snapshotBody({ publishedAt: 'yesterday' }),
    ],
    ['an array payload', snapshotBody({ payload: [] })],
  ])('rejects %s as malformed', (_label, body) => {
    expect(rejectionOf(body)).toBe(ManagedRejectionReason.Malformed);
  });

  it('rejects a payload over 57,344 canonical bytes', () => {
    const body = snapshotBody({
      appId: 'launchpad',
      instanceId: 'launchpad-dev',
      payload: { blob: 'x'.repeat(57_344) },
    });
    expect(
      rejectionOf(
        body,
        chatContext({ appId: 'launchpad', instanceId: 'launchpad-dev' }),
      ),
    ).toBe(ManagedRejectionReason.PayloadTooLarge);
  });

  it('rejects changed content for a known revision', () => {
    const body = snapshotBody({ payload: VALID_PAYLOAD });
    const known = chatContext({
      knownRevision: () => ({
        sha256: body['sha256'] as string,
        payloadSha256: canonicalSha256({ config: {}, features: {} }),
      }),
    });
    expect(rejectionOf(body, known)).toBe(
      ManagedRejectionReason.RevisionChanged,
    );
  });

  it('accepts a known revision returned unchanged', () => {
    const body = snapshotBody({ payload: VALID_PAYLOAD });
    const known = chatContext({
      knownRevision: () => ({
        sha256: body['sha256'] as string,
        payloadSha256: canonicalSha256(VALID_PAYLOAD),
      }),
    });
    expect(acceptSnapshot(body, known).accepted).toBe(true);
  });

  it('rejects a schema edited under the same version', () => {
    expect(rejectionOf(snapshotBody({ schemaSha256: 'f'.repeat(64) }))).toBe(
      ManagedRejectionReason.UnsupportedSchema,
    );
  });

  it('rejects a version this build does not support', () => {
    expect(rejectionOf(snapshotBody({ schemaVersion: '1.3.0' }))).toBe(
      ManagedRejectionReason.UnsupportedSchema,
    );
  });

  it('keeps accepting a 1.0.0 snapshot against its own artifact', () => {
    const result = acceptSnapshot(
      snapshotBody({ ...V100, payload: VALID_PAYLOAD }),
      chatContext(),
    );
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.snapshot.schemaVersion).toBe('1.0.0');
  });

  it('rejects a 1.1.0 key under the 1.0.0 version', () => {
    const payload = {
      config: { 'announcement.title': 'Maintenance tonight' },
      features: {},
    };
    expect(rejectionOf(snapshotBody({ ...V100, payload }))).toBe(
      ManagedRejectionReason.InvalidPayload,
    );
  });

  it('accepts a 1.1.0 snapshot with announcements and an event', () => {
    const payload = {
      config: {
        'announcement.title': 'Maintenance',
        'announcement.description': 'Saturday <b>10:00 UTC</b>',
        'announcement.items': [
          { title: 'DIAL 1.49', severity: 'warning' },
          {
            title: 'Changelog',
            link: { label: 'Read', href: 'https://example.com/changelog' },
          },
          { title: 'Tips', description: 'Use <em>projects</em>.' },
        ],
        'ui.activeEventId': 'new-year',
      },
      features: {},
    };
    const result = acceptSnapshot(
      snapshotBody({ ...V110, payload }),
      chatContext(),
    );
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.snapshot.schemaVersion).toBe('1.1.0');
  });

  it('rejects a 1.2.0 feature under the 1.1.0 version', () => {
    const payload = {
      config: {},
      features: { 'features.usageLimitsControl': { enabled: true } },
    };
    expect(rejectionOf(snapshotBody({ ...V110, payload }))).toBe(
      ManagedRejectionReason.InvalidPayload,
    );
  });

  it('accepts a 1.2.0 snapshot with the welcome text, tabs, usage values and feature', () => {
    const payload = {
      config: {
        'welcomeScreen.description': 'Ask me anything',
        'fileManager.availableTabs': ['my_files', 'shared'],
        'usageLimits.warningThresholdPercent': 90,
        'usageLimits.spendingLimitsMode': 'enforce',
      },
      features: { 'features.usageLimitsControl': { enabled: true } },
    };
    const result = acceptSnapshot(snapshotBody({ payload }), chatContext());
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    expect(result.snapshot.schemaVersion).toBe('1.2.0');
  });

  it('rejects an announcement title Studio would never publish', () => {
    const payload = {
      config: { 'announcement.title': 't'.repeat(201) },
      features: {},
    };
    expect(rejectionOf(snapshotBody({ payload }))).toBe(
      ManagedRejectionReason.InvalidPayload,
    );
  });

  it('rejects an unknown policy member instead of ignoring it', () => {
    const payload = {
      config: {},
      features: {
        'features.usageLimitsControl': { enabled: true, percentage: 5 },
      },
    };
    expect(rejectionOf(snapshotBody({ payload }))).toBe(
      ManagedRejectionReason.InvalidPayload,
    );
  });

  it.each([
    ['a local-only key', { config: { 'footer.html': 'x' }, features: {} }],
    ['a null value', { config: { 'onboarding.hints': null }, features: {} }],
    [
      'a key the current schema does not manage',
      { config: { 'mcpApps.theme': 'dark' }, features: {} },
    ],
    [
      'a feature the current schema does not manage',
      {
        config: {},
        features: { 'features.projectsEnabled': { enabled: true } },
      },
    ],
  ])('rejects %s as an invalid payload', (_label, payload) => {
    expect(rejectionOf(snapshotBody({ payload }))).toBe(
      ManagedRejectionReason.InvalidPayload,
    );
  });

  it.each([
    ['an unknown target', tour({ ...HINT, target: 'settings-gear' })],
    ['a missing target', tour({ id: HINT.id, title: HINT.title })],
    ['an extra property', tour({ ...HINT, selector: '#new-chat' })],
    ['an id outside the allowlist', tour({ ...HINT, id: 'tour start' })],
    ['an id over 64 characters', tour({ ...HINT, id: 'i'.repeat(65) })],
    ['a blank title', tour({ ...HINT, title: '   ' })],
    ['a title over 100 characters', tour({ ...HINT, title: 't'.repeat(101) })],
    [
      'a description over 500 characters',
      tour({ ...HINT, description: 'd'.repeat(501) }),
    ],
    [
      'more than 50 hints',
      tour(...Array.from({ length: 51 }, (_, i) => ({ ...HINT, id: `h${i}` }))),
    ],
  ])('rejects an onboarding hint with %s at admission', (_label, payload) => {
    expect(rejectionOf(snapshotBody({ payload }))).toBe(
      ManagedRejectionReason.InvalidPayload,
    );
  });

  it('accepts a tour at every bound and leaves repeated ids to the client mapping', () => {
    const payload = tour(
      ...Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`.padStart(64, 'i'),
        target: 'navigation',
        title: 't'.repeat(100),
        description: 'd'.repeat(500),
      })),
    );
    expect(
      acceptSnapshot(snapshotBody({ payload }), chatContext()).accepted,
    ).toBe(true);
    expect(
      acceptSnapshot(snapshotBody({ payload: tour(HINT, HINT) }), chatContext())
        .accepted,
    ).toBe(true);
  });

  it.each([
    [
      'an offset timestamp',
      {
        config: {},
        features: {
          'features.usageLimitsControl': {
            enabled: true,
            availability: { startsAt: '2026-11-01T08:00:00+02:00' },
          },
        },
      },
    ],
    [
      'an empty role list',
      {
        config: {},
        features: {
          'features.usageLimitsControl': {
            enabled: true,
            targeting: { roles: [] },
          },
        },
      },
    ],
  ])(
    'rejects a feature policy with %s as an invalid payload',
    (_label, payload) => {
      expect(rejectionOf(snapshotBody({ payload }))).toBe(
        ManagedRejectionReason.InvalidPayload,
      );
    },
  );

  it.each([
    ['an impossible date', { startsAt: '2027-02-30T00:00:00Z' }],
    [
      'an inverted window',
      {
        startsAt: '2026-12-01T00:00:00Z',
        endsAt: '2026-11-01T00:00:00Z',
      },
    ],
  ])('rejects %s as a semantic violation', (_label, availability) => {
    const payload = {
      config: {},
      features: {
        'features.usageLimitsControl': { enabled: true, availability },
      },
    };
    expect(rejectionOf(snapshotBody({ payload }))).toBe(
      ManagedRejectionReason.SemanticViolation,
    );
  });

  it('accepts a foreign payload without validating it against a schema', () => {
    const body = snapshotBody({
      appId: 'launchpad',
      instanceId: 'launchpad-dev',
      schemaVersion: '2.0.0',
      schemaSha256: 'a'.repeat(64),
      payload: { blocks: [{ id: 'news' }] },
    });
    const result = acceptSnapshot(
      body,
      chatContext({ appId: 'launchpad', instanceId: 'launchpad-dev' }),
    );
    expect(result.accepted).toBe(true);
  });
});

describe('compileManagedPayloadValidators', () => {
  it('compiles every supported version from the bundled artifacts', () => {
    expect([...validators.keys()]).toEqual(['1.0.0', '1.1.0', '1.2.0']);
  });

  it('refuses an artifact whose hash differs from its pin', () => {
    const tampered = {
      ...chatUiSchemaArtifact100,
      schema: { ...chatUiSchemaArtifact100.schema, title: 'Edited' },
    };
    expect(() => compileManagedPayloadValidators([tampered])).toThrow(
      'does not match its pinned hash',
    );
  });

  it('refuses a supported version without a bundled artifact', () => {
    expect(() => compileManagedPayloadValidators([])).toThrow(
      'No bundled managed-config schema for 1.0.0',
    );
  });
});
