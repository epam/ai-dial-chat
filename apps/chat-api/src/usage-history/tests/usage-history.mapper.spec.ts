import { describe, expect, it } from 'vitest';
import { UsageHistoryPeriod } from '../types/usage-history-period';
import {
  buildAvailableHistory,
  mapClientSplit,
  parseSpend,
  rankDeployments,
  toRoundedSpend,
  UsageHistoryMappingError,
} from '../usage-history.mapper';
import { resolveUsageWindow, type UsageWindow } from '../usage-period';

const WEEK = resolveUsageWindow(
  UsageHistoryPeriod.Week,
  new Date('2026-11-19T10:00:00.000Z'),
); /* Monday 16th → Thursday 19th */

const day = (date: string) => `${date} 00:00:00.000`;

const dailyRow = (date: string, spend: string | null, requests: number) => ({
  usage_day: day(date),
  usage_spend: spend,
  usage_requests: requests,
});

const modelRow = (
  deployment: string,
  spend: string | null,
  requests: number,
) => ({
  deployment,
  usage_spend: spend,
  usage_spend_rank: spend === null ? null : Number(spend),
  usage_requests: requests,
});

const dailyModelRow = (
  date: string,
  deployment: string,
  spend: string | null,
  requests: number,
) => ({
  usage_day: day(date),
  deployment,
  usage_spend: spend,
  usage_requests: requests,
});

const build = ({
  window = WEEK,
  daily = [] as object[],
  models = [] as object[],
  dailyModels,
  clients,
}: {
  window?: UsageWindow;
  daily?: object[];
  models?: object[];
  dailyModels?: object[];
  clients?: object[];
}) =>
  buildAvailableHistory({
    period: UsageHistoryPeriod.Week,
    window,
    dailyTotals: { rows: daily },
    ranked: rankDeployments({ rows: models }),
    dailyTopModels:
      dailyModels === undefined ? undefined : { rows: dailyModels },
    clientSplit: clients === undefined ? undefined : { rows: clients },
  });

describe('usage history mapper', () => {
  describe('money', () => {
    it.each([
      ['0.123456789012', 0.123457],
      ['0.0000005', 0.000001],
      ['0.0000004999', 0],
      ['-0.0000005', -0.000001],
      ['12', 12],
      ['1.5', 1.5],
    ])('rounds %s half away from zero to %d', (text, expected) => {
      expect(toRoundedSpend(parseSpend(text))).toBe(expected);
    });

    it('reads a null sum as zero', () => {
      expect(parseSpend(null)).toBe(0n);
    });

    it('sums exactly where floating point would drift', () => {
      const tenths = Array.from({ length: 10 }, () => parseSpend('0.1'));

      expect(toRoundedSpend(tenths.reduce((a, b) => a + b, 0n))).toBe(1);
      expect(toRoundedSpend(parseSpend('0.1') + parseSpend('0.2'))).toBe(0.3);
    });

    it.each(['1e-7', 'abc', '', '1.2.3', true, 0.1, 12])(
      'rejects the malformed spend cell %j',
      (cell) => {
        expect(() => parseSpend(cell)).toThrow(UsageHistoryMappingError);
      },
    );
  });

  describe('daily series', () => {
    it('zero-fills every date of the window in ascending order', () => {
      const history = build({
        daily: [dailyRow('2026-11-17', '0.5', 2)],
        models: [modelRow('gpt-4o', '0.5', 2)],
        dailyModels: [dailyModelRow('2026-11-17', 'gpt-4o', '0.5', 2)],
      });

      expect(history.daily).toEqual([
        { date: '2026-11-16', spend: 0, requests: 0, byModel: {} },
        {
          date: '2026-11-17',
          spend: 0.5,
          requests: 2,
          byModel: { 'gpt-4o': 0.5 },
        },
        { date: '2026-11-18', spend: 0, requests: 0, byModel: {} },
        { date: '2026-11-19', spend: 0, requests: 0, byModel: {} },
      ]);
    });

    it('returns zeros, no models and no client key for empty usage', () => {
      const history = build({});

      expect(history).toEqual({
        available: true,
        period: {
          name: 'week',
          from: '2026-11-16T00:00:00.000Z',
          to: '2026-11-19T10:00:00.000Z',
        },
        currency: 'USD',
        totals: { spend: 0, requests: 0 },
        daily: WEEK.dates.map((date) => ({
          date,
          spend: 0,
          requests: 0,
          byModel: {},
        })),
        byModel: [],
      });
      expect('byClient' in history).toBe(false);
    });

    it('keeps a deployment with requests but no price on that date', () => {
      const history = build({
        daily: [dailyRow('2026-11-16', null, 3)],
        models: [modelRow('mcp-toolset', null, 3)],
        dailyModels: [dailyModelRow('2026-11-16', 'mcp-toolset', null, 3)],
      });

      expect(history.totals).toEqual({ spend: 0, requests: 3 });
      expect(history.daily?.[0].byModel).toEqual({ 'mcp-toolset': 0 });
    });

    it.each([
      ['a day outside the window', [dailyRow('2026-11-30', '1', 1)]],
      [
        'a day that is not midnight',
        [
          {
            usage_day: '2026-11-16 12:00:00.000',
            usage_spend: '1',
            usage_requests: 1,
          },
        ],
      ],
      [
        'a negative count',
        [
          {
            usage_day: day('2026-11-16'),
            usage_spend: '1',
            usage_requests: -1,
          },
        ],
      ],
      [
        'a non-numeric spend',
        [
          {
            usage_day: day('2026-11-16'),
            usage_spend: 'n/a',
            usage_requests: 1,
          },
        ],
      ],
    ])('rejects %s', (_label, rows) => {
      expect(() => build({ daily: rows })).toThrow(UsageHistoryMappingError);
    });

    it('rejects a response without rows', () => {
      expect(() =>
        buildAvailableHistory({
          period: UsageHistoryPeriod.Week,
          window: WEEK,
          dailyTotals: { data: [] },
          ranked: [],
        }),
      ).toThrow(UsageHistoryMappingError);
    });

    it.each(['2026-11-16', '2026-11-16 00:00:00', '2026-11-16 00:00:00.000'])(
      'reads the day bucket rendered as %j',
      (bucket) => {
        const history = build({
          daily: [{ usage_day: bucket, usage_spend: '1', usage_requests: 1 }],
        });

        expect(history.daily?.[0]).toMatchObject({
          date: '2026-11-16',
          spend: 1,
          requests: 1,
        });
      },
    );

    it('accepts a request count sent as a digit string', () => {
      const history = build({
        daily: [dailyRow('2026-11-16', '1', '7' as unknown as number)],
      });

      expect(history.totals?.requests).toBe(7);
    });
  });

  describe('model breakdown', () => {
    const twelveModels = Array.from({ length: 12 }, (_, index) =>
      modelRow(
        `model-${String(index).padStart(2, '0')}`,
        String(12 - index),
        1,
      ),
    );
    /* model-00 spends 12, …, model-11 spends 1: 78 in total over 12 requests. */
    const twelveDaily = [dailyRow('2026-11-16', '78', 12)];

    it('lists at most ten deployments then other with the remainder', () => {
      const history = build({
        daily: twelveDaily,
        models: twelveModels,
        dailyModels: twelveModels
          .slice(0, 10)
          .map((row) =>
            dailyModelRow('2026-11-16', row.deployment, row.usage_spend, 1),
          ),
      });

      expect(history.byModel).toHaveLength(11);
      expect(history.byModel?.slice(0, 2)).toEqual([
        { deployment: 'model-00', spend: 12, requests: 1 },
        { deployment: 'model-01', spend: 11, requests: 1 },
      ]);
      expect(history.byModel?.[10]).toEqual({
        deployment: 'other',
        spend: 3,
        requests: 2,
      });
      expect(Object.keys(history.daily?.[0].byModel ?? {})).toEqual([
        ...twelveModels.slice(0, 10).map((row) => row.deployment),
        'other',
      ]);
      expect(history.daily?.[0].byModel.other).toBe(3);
    });

    it('has no other entry for exactly ten deployments', () => {
      const ten = twelveModels.slice(0, 10);
      const history = build({
        daily: [dailyRow('2026-11-16', '75', 10)],
        models: ten,
        dailyModels: ten.map((row) =>
          dailyModelRow('2026-11-16', row.deployment, row.usage_spend, 1),
        ),
      });

      expect(history.byModel).toHaveLength(10);
      expect(history.byModel?.map((entry) => entry.deployment)).not.toContain(
        'other',
      );
    });

    it('shows only other on a day used only by lower-ranked deployments', () => {
      const history = build({
        daily: [...twelveDaily, dailyRow('2026-11-18', '0.25', 2)],
        models: twelveModels,
        dailyModels: [],
      });

      expect(history.daily?.[2]).toEqual({
        date: '2026-11-18',
        spend: 0.25,
        requests: 2,
        byModel: { other: 0.25 },
      });
    });

    it('breaks spend ties by requests, then by name', () => {
      const ranked = rankDeployments({
        rows: [
          modelRow('b', '1', 1),
          modelRow('a', '1', 1),
          modelRow('c', '1', 5),
          modelRow('d', '2', 1),
        ],
      });

      expect(ranked.map((entry) => entry.deployment)).toEqual([
        'd',
        'c',
        'a',
        'b',
      ]);
    });

    it('lists a real deployment named other by name when there is no remainder', () => {
      const history = build({
        daily: [dailyRow('2026-11-16', '1', 1)],
        models: [modelRow('other', '1', 1)],
        dailyModels: [dailyModelRow('2026-11-16', 'other', '1', 1)],
      });

      expect(history.byModel).toEqual([
        { deployment: 'other', spend: 1, requests: 1 },
      ]);
    });

    it('folds a real deployment named other into the remainder', () => {
      const models = [
        modelRow('other', '100', 1),
        ...twelveModels.slice(0, 10),
      ];
      const history = build({
        daily: [dailyRow('2026-11-16', '175', 11)],
        models,
      });

      const names = history.byModel?.map((entry) => entry.deployment) ?? [];
      expect(names.filter((name) => name === 'other')).toHaveLength(1);
      expect(names.at(-1)).toBe('other');
      expect(history.byModel?.at(-1)).toEqual({
        deployment: 'other',
        spend: 100,
        requests: 1,
      });
    });

    it('rejects a per-day row for a deployment that was not requested', () => {
      expect(() =>
        build({
          daily: [dailyRow('2026-11-16', '1', 1)],
          models: [modelRow('gpt-4o', '1', 1)],
          dailyModels: [dailyModelRow('2026-11-16', 'claude', '1', 1)],
        }),
      ).toThrow(UsageHistoryMappingError);
    });

    it('never reports a negative remainder when a later query saw more rows', () => {
      const history = build({
        daily: [dailyRow('2026-11-16', '10', 10)],
        models: twelveModels,
      });

      expect(history.byModel?.at(-1)).toEqual({
        deployment: 'other',
        spend: 0,
        requests: 0,
      });
    });
  });

  describe('client breakdown', () => {
    it('merges missing enrichment values into unknown and sorts by spend', () => {
      expect(
        mapClientSplit({
          rows: [
            { usage_client: 'chat', usage_spend: '1', usage_requests: 3 },
            { usage_client: null, usage_spend: '0.5', usage_requests: 1 },
            { usage_client: '', usage_spend: '0.75', usage_requests: 2 },
            { usage_client: 'claudecode', usage_spend: '2', usage_requests: 1 },
          ],
        }),
      ).toEqual([
        { client: 'claudecode', spend: 2, requests: 1 },
        { client: 'unknown', spend: 1.25, requests: 3 },
        { client: 'chat', spend: 1, requests: 3 },
      ]);
    });

    it('adds byClient only when the client split was queried', () => {
      const history = build({
        clients: [
          { usage_client: 'chat', usage_spend: '0', usage_requests: 0 },
        ],
      });

      expect(history.byClient).toEqual([
        { client: 'chat', spend: 0, requests: 0 },
      ]);
    });

    it('rejects a client cell that is not a string', () => {
      expect(() =>
        mapClientSplit({
          rows: [{ usage_client: 42, usage_spend: '1', usage_requests: 1 }],
        }),
      ).toThrow(UsageHistoryMappingError);
    });
  });
});
