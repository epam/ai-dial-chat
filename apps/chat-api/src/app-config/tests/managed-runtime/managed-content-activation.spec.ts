import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigEvalContext } from '../../app-config.types';
import { PINNED_MANAGED_CONFIG_SCHEMA_SHA256 } from '../../managed-config/managed-config.constants';
import {
  RuntimeReadKind,
  type RuntimeReadResult,
} from '../../managed-runtime/snapshot-reader';
import {
  activeManagedEnvironment,
  buildManagedStack,
  destroyManagedStacks,
  publishedRevision,
} from './managed-stack.fixtures';

/*
 * The announcement and celebration keys of the real 1.1.0 contract, end to
 * end: a fake Core reader, the real acceptance, the real provider chain and
 * the shared client-config mapping. No test-only contract is mocked in.
 */

const INTERVAL = 60_000;
const DELIVERY_KEYS = [
  'ui.celebrationDelivery.mode',
  'ui.celebrationDelivery.revision',
  'ui.celebrationDelivery.externalScenes',
  'ui.celebrationDelivery.externalEvents',
];
const ANNOUNCEMENT_KEYS = [
  'announcement.title',
  'announcement.description',
  'announcement.items',
];
const CELEBRATION_KEYS = [
  'ui.activeEventId',
  'ui.celebrationsEnabledByDefault',
  ...DELIVERY_KEYS,
];

const anonymous: AppConfigEvalContext = { appId: 'ai-dial-chat' };

const active = activeManagedEnvironment;

const published = (
  revisionId: string,
  config: Record<string, unknown>,
  envelope: Record<string, unknown> = {},
): RuntimeReadResult =>
  publishedRevision(revisionId, { config, features: {} }, envelope);

const buildStack = buildManagedStack;

/* The client config a publication produces, with its keys active. */
const managedConfig = async (
  keys: readonly string[],
  config: Record<string, unknown>,
  raw: Record<string, unknown> = {},
) => {
  const { service } = await buildStack({ ...active(...keys), ...raw }, (fake) =>
    fake.respondAlways('chat-dev', published('r1', config)),
  );
  return (await service.getClientConfig(anonymous)).config;
};

/* The client config the same content produces through ENV alone. */
const environmentConfig = async (raw: Record<string, unknown>) => {
  const { service } = await buildStack(raw);
  return (await service.getClientConfig(anonymous)).config;
};

describe('managed announcements and celebrations', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });
  afterEach(() => {
    destroyManagedStacks();
    vi.restoreAllMocks();
  });

  describe('parity with the environment', () => {
    it('sanitizes a published banner text exactly like the environment value', async () => {
      const markup =
        '<b>Maintenance</b> tonight <script>alert(1)</script><a href="https://status.example.com" onclick="x()">status</a>';
      const managed = await managedConfig(['announcement.description'], {
        'announcement.description': markup,
      });
      const environment = await environmentConfig({
        ANNOUNCEMENT_DESCRIPTION: markup,
      });
      expect(managed.announcementDescription).toBe(
        '<b>Maintenance</b> tonight <a href="https://status.example.com" target="_blank" rel="noopener noreferrer">status</a>',
      );
      expect(managed.announcementDescription).toBe(
        environment.announcementDescription,
      );
    });

    it('shows a published banner title as literal text', async () => {
      const managed = await managedConfig(['announcement.title'], {
        'announcement.title': '<b>New</b> release',
      });
      expect(managed.announcementTitle).toBe('<b>New</b> release');
    });

    it('normalizes a published list exactly like the environment list', async () => {
      const items = [
        { title: '  Padded  ' },
        { title: 'Broken', link: { label: 'Open', href: 'https://[' } },
      ];
      const managed = await managedConfig(['announcement.items'], {
        'announcement.items': items,
      });
      const managedWarnings = warn.mock.calls.map((call: unknown[]) =>
        String(call[0]),
      );
      warn.mockClear();
      const environment = await environmentConfig({
        ANNOUNCEMENTS: JSON.stringify(items),
      });
      expect(managed.announcements).toEqual([
        { title: 'Padded', description: null, link: null, severity: 'info' },
      ]);
      expect(managed.announcements).toEqual(environment.announcements);
      expect(managedWarnings).toContainEqual(
        expect.stringContaining('Ignoring announcement "Broken"'),
      );
    });

    it('builds the delivery object from a published policy', async () => {
      const managed = await managedConfig(DELIVERY_KEYS, {
        'ui.celebrationDelivery.mode': 'prefer-external',
        'ui.celebrationDelivery.revision': '2026-12-01.1',
        'ui.celebrationDelivery.externalScenes': ['new-year/snowman-delivery'],
        'ui.celebrationDelivery.externalEvents': ['company-anniversary'],
      });
      const environment = await environmentConfig({
        UI_EVENT_DELIVERY_MODE: 'prefer-external',
        UI_EVENT_DELIVERY_REVISION: '2026-12-01.1',
        UI_EVENT_EXTERNAL_SCENES: 'new-year/snowman-delivery',
        UI_EVENT_EXTERNAL_EVENTS: 'company-anniversary',
      });
      expect(managed.celebrationDelivery).toEqual({
        mode: 'prefer-external',
        revision: '2026-12-01.1',
        externalScenes: [{ eventId: 'new-year', sceneId: 'snowman-delivery' }],
        externalEvents: ['company-anniversary'],
      });
      expect(managed.celebrationDelivery).toEqual(
        environment.celebrationDelivery,
      );
    });

    it('applies a published default for the celebrations switch', async () => {
      const managed = await managedConfig(['ui.celebrationsEnabledByDefault'], {
        'ui.celebrationsEnabledByDefault': false,
      });
      expect(managed.celebrationsEnabledByDefault).toBe(false);
    });
  });

  describe('the celebration event', () => {
    it('switches the season after the next accepted read, without a restart', async () => {
      const { service, clock } = await buildStack(
        active('ui.activeEventId'),
        (fake) => {
          fake.respond(
            'chat-dev',
            published('r1', { 'ui.activeEventId': 'halloween' }),
          );
          fake.respondAlways(
            'chat-dev',
            published('r2', { 'ui.activeEventId': 'new-year' }),
          );
        },
      );
      expect(
        (await service.getClientConfig(anonymous)).config.activeEventId,
      ).toBe('halloween');

      await clock.advance(INTERVAL);
      const next = await service.getClientConfig(anonymous);
      expect(next.config.activeEventId).toBe('new-year');
      expect(next.metadata?.managed?.revisionId).toBe('r2');
    });

    it.each([
      ['an explicit event', { UI_EVENT: 'halloween' }, 'halloween'],
      ['an explicit none', { UI_EVENT: 'none' }, null],
    ])('lets %s in the environment win', async (_label, raw, expected) => {
      const managed = await managedConfig(
        ['ui.activeEventId'],
        { 'ui.activeEventId': 'new-year' },
        raw,
      );
      expect(managed.activeEventId).toBe(expected);
    });

    it('turns celebrations off for a published none', async () => {
      const managed = await managedConfig(['ui.activeEventId'], {
        'ui.activeEventId': 'none',
      });
      expect(managed.activeEventId).toBeNull();
    });

    it('passes an unknown published event through for the frontend to ignore', async () => {
      const managed = await managedConfig(['ui.activeEventId'], {
        'ui.activeEventId': 'easter',
      });
      expect(managed.activeEventId).toBe('easter');
    });
  });

  describe('the delivery policy', () => {
    const policy = {
      'ui.celebrationDelivery.mode': 'prefer-external',
      'ui.celebrationDelivery.revision': '7',
      'ui.celebrationDelivery.externalScenes': ['new-year/snowman-delivery'],
      'ui.celebrationDelivery.externalEvents': ['product-launch'],
    };

    it('lets one explicit environment part override its published part', async () => {
      const managed = await managedConfig(DELIVERY_KEYS, policy, {
        UI_EVENT_EXTERNAL_EVENTS: 'company-anniversary',
      });
      expect(managed.celebrationDelivery.externalEvents).toEqual([
        'company-anniversary',
      ]);
      expect(managed.celebrationDelivery.mode).toBe('prefer-external');
    });

    it('keeps every scene bundled under an explicit bundled mode', async () => {
      const managed = await managedConfig(DELIVERY_KEYS, policy, {
        UI_EVENT_DELIVERY_MODE: 'bundled',
      });
      expect(managed.celebrationDelivery.mode).toBe('bundled');
    });

    it('serves the default policy once the snapshot is stale', async () => {
      const { service, clock } = await buildStack(
        active(...DELIVERY_KEYS),
        (fake) => {
          fake.respond('chat-dev', published('r1', policy));
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable });
        },
      );
      await clock.advance(900_001);
      const stale = await service.getClientConfig(anonymous);
      expect(stale.metadata?.managed?.state).toBe('stale');
      expect(stale.config.celebrationDelivery).toEqual({
        mode: 'bundled',
        revision: '0',
        externalScenes: [],
        externalEvents: [],
      });
    });
  });

  describe('unusable states and rollback', () => {
    it('keeps the last accepted banner while a read fails', async () => {
      const { service, clock } = await buildStack(
        active('announcement.title'),
        (fake) => {
          fake.respond(
            'chat-dev',
            published('r1', { 'announcement.title': 'From R1' }),
          );
          fake.respondAlways('chat-dev', { kind: RuntimeReadKind.Unavailable });
        },
      );
      await clock.advance(INTERVAL);
      const degraded = await service.getClientConfig(anonymous);
      expect(degraded.metadata?.managed?.state).toBe('degraded');
      expect(degraded.config.announcementTitle).toBe('From R1');
    });

    it('falls back to the environment and defaults when nothing is published', async () => {
      const { service } = await buildStack(
        {
          ...active('announcement.items', 'ui.activeEventId'),
          UI_EVENT: 'halloween',
        },
        (fake) =>
          fake.respondAlways('chat-dev', {
            kind: RuntimeReadKind.NotPublished,
          }),
      );
      const response = await service.getClientConfig(anonymous);
      expect(response.metadata?.managed?.state).toBe('not_published');
      expect(response.config.announcements).toEqual([]);
      expect(response.config.activeEventId).toBe('halloween');
    });

    it('applies a rollback as an ordinary new revision', async () => {
      const r1 = { 'announcement.items': [{ title: 'Original' }] };
      const { service, clock } = await buildStack(
        active('announcement.items'),
        (fake) => {
          fake.respond('chat-dev', published('r1', r1));
          fake.respond(
            'chat-dev',
            published('r2', { 'announcement.items': [{ title: 'Mistake' }] }),
          );
          fake.respondAlways('chat-dev', published('r3', r1));
        },
      );
      const titles = async () =>
        (await service.getClientConfig(anonymous)).config.announcements.map(
          ({ title }) => title,
        );
      expect(await titles()).toEqual(['Original']);
      await clock.advance(INTERVAL);
      expect(await titles()).toEqual(['Mistake']);
      await clock.advance(INTERVAL);
      const rolledBack = await service.getClientConfig(anonymous);
      expect(rolledBack.config.announcements.map(({ title }) => title)).toEqual(
        ['Original'],
      );
      expect(rolledBack.metadata?.managed?.revisionId).toBe('r3');
    });

    it('supplies no 1.1.0 value from a 1.0.0 snapshot', async () => {
      const { service } = await buildStack(
        active('onboarding.hints', ...ANNOUNCEMENT_KEYS, ...CELEBRATION_KEYS),
        (fake) =>
          fake.respondAlways(
            'chat-dev',
            published(
              'r1',
              {
                'onboarding.hints': [
                  { id: 'tour.start', target: 'new-chat', title: 'Start' },
                ],
              },
              {
                schemaVersion: '1.0.0',
                schemaSha256: PINNED_MANAGED_CONFIG_SCHEMA_SHA256['1.0.0'],
              },
            ),
          ),
      );
      const response = await service.getClientConfig(anonymous);
      expect(response.metadata?.managed?.state).toBe('fresh');
      expect(response.config.onboardingHints).toHaveLength(1);
      expect(response.config.announcementTitle).toBeNull();
      expect(response.config.announcements).toEqual([]);
      expect(response.config.activeEventId).toBeNull();
    });
  });
});
