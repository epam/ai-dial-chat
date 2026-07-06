import type { ModelUsageRowData, UsageWindowData } from '@epam/ai-dial-kit';

// TODO: replace with real account usage data once the usage/budget API lands.
export const MOCK_USAGE_WINDOWS: UsageWindowData[] = [
  {
    title: 'Daily limit',
    scope: 'All models',
    used: 3.6,
    limit: 4,
    resetLabel: 'Resets 00:00 · in 6h 12m',
  },
  {
    title: 'Monthly limit',
    scope: 'All models',
    used: 41,
    limit: 120,
    resetLabel: 'Resets 1 Aug · in 12 days',
  },
];

export const MOCK_USAGE_ROWS: ModelUsageRowData[] = [
  {
    id: 'claude-opus',
    name: 'Claude Opus',
    version: '4.8',
    today: { used: 2, limit: 2, resetLabel: 'Resets in 4h' },
    thisMonth: { used: 12, limit: 30, resetLabel: 'Resets 1 Aug' },
  },
  {
    id: 'deepseek-flash',
    name: 'ali.deepseek-v4-flash',
    version: '4.0.1',
    today: { used: 0.4, limit: null },
    thisMonth: { used: 17, limit: 20, resetLabel: 'Resets 1 Aug' },
  },
  {
    id: 'glm',
    name: 'GLM-5.2',
    version: '5.2.1',
    today: { used: 0.5, limit: null },
    thisMonth: { used: 6.2, limit: 40, resetLabel: 'Resets 1 Aug' },
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    version: '2024-11',
    today: { used: 0.2, limit: null },
    thisMonth: { used: 4.1, limit: null },
  },
  {
    id: 'deepseek-pro',
    name: 'ali.deepseek-v4-pro',
    version: '4.0.0',
    today: { used: 0.1, limit: null },
    thisMonth: { used: 1.7, limit: null },
  },
];
