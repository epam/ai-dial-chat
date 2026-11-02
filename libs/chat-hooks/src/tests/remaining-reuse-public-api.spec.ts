import { toConversationTransferQueueItems } from '@epam/ai-dial-chat-shared';
import { useHtmlTagAnnotationGroups } from '@epam/ai-dial-quotations';
import { describe, expect, it } from 'vitest';
import {
  createGenerationRegistry,
  useConversationTitleEnrichmentController,
  useDeploymentChangeTracking,
  UploadMimeTypePolicy,
} from '../entry-points/conversation';
import { useExternalServiceLogin } from '../entry-points/external-services';
import {
  resolveActiveScheduledTask,
  useActiveScheduledTaskDetails,
} from '../entry-points/scheduled-tasks';
import { useSkillFilePreviewSyncController } from '../entry-points/skill-editor';
import {
  UsageResetOffsetPolicy,
  formatUsageResetTime,
} from '../entry-points/usage-limits';

describe('remaining-reuse-public-api', () => {
  it('publishes controllers and isolates instances', () => {
    for (const api of [
      useConversationTitleEnrichmentController,
      useDeploymentChangeTracking,
      resolveActiveScheduledTask,
      useActiveScheduledTaskDetails,
      useSkillFilePreviewSyncController,
      useExternalServiceLogin,
      useHtmlTagAnnotationGroups,
      toConversationTransferQueueItems,
    ])
      expect(typeof api).toBe('function');
    const a = createGenerationRegistry();
    const b = createGenerationRegistry();
    a.startGeneration('x', 'one');
    expect(b.hasActiveGeneration()).toBe(false);
    expect(UploadMimeTypePolicy.Normalize).toBe('normalize');
    expect(UploadMimeTypePolicy.Preserve).toBe('preserve');
    for (const offsetPolicy of Object.values(UsageResetOffsetPolicy))
      expect(
        formatUsageResetTime(
          '2026-01-01T00:00:00Z',
          'en',
          (_key, options) => String(options?.dateTime),
          { offsetPolicy },
        )?.isoValue,
      ).toBe('2026-01-01T00:00:00Z');
  });
});
