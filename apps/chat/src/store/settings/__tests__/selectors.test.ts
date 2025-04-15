import { describe, expect, it } from 'vitest';

import { FeatureType } from '@/src/types/common';
import { CustomVisualizer } from '@/src/types/custom-visualizers';

import { SettingsSelectors } from '../settings.selectors';

import { Feature } from '@epam/ai-dial-shared';

describe('SettingsSelectors', () => {
  const mockState = {
    settings: {
      customRenderers: [
        {
          title: 'Visualizator 1',
          contentType: 'application/custom.type1+json',
          url: 'http://localhost:3000/visualizator1',
        },
        {
          title: 'Visualizator 2',
          contentType: 'application/custom.type2+json',
          url: 'http://localhost:3000/visualizator2',
        },
        {
          title: 'Visualizator 3',
          contentType: 'application/custom.type1+json',
          url: 'http://localhost:3000/visualizator3',
        },
      ] as CustomVisualizer[],
      enabledFeatures: [
        Feature.ConversationsSharing,
        Feature.PromptsSharing,
        Feature.PromptsPublishing,
      ],
    },
    auth: {
      session: {
        data: {
          user: {
            isAdmin: false,
            [Feature.ConversationsSharing]: true,
            [Feature.PromptsSharing]: true,
            [Feature.PromptsPublishing]: true,
          },
        },
      },
    },
  };

  it('should filter enabled features for the user', () => {
    const result = SettingsSelectors.selectEnabledFeatures(mockState);
    expect(result).toEqual(
      new Set([
        Feature.ConversationsSharing,
        Feature.PromptsSharing,
        Feature.PromptsPublishing,
      ]),
    );
  });

  //TODO make role based check
  it('should check if feature is enabled', () => {
    const result = SettingsSelectors.isFeatureEnabled(
      mockState,
      Feature.ConversationsSharing,
    );
    expect(result).toBe(true);
  });

  it('should check if conversations publishing is not enabled', () => {
    const resultChat = SettingsSelectors.selectIsPublishingEnabled(
      mockState,
      FeatureType.Chat,
    );
    expect(resultChat).toBe(false);

    const resultPrompt = SettingsSelectors.selectIsPublishingEnabled(
      mockState,
      FeatureType.Prompt,
    );
    expect(resultPrompt).toBe(true);
  });

  it('should check if feature type is sharing enabled', () => {
    const result = SettingsSelectors.isSharingEnabled(
      mockState,
      FeatureType.Chat,
    );
    expect(result).toBe(true);
  });

  it('should select mapped visualizers', () => {
    const result = SettingsSelectors.selectMappedVisualizers(mockState);

    expect(result).toEqual({
      'application/custom.type1+json': [
        {
          title: 'Visualizator 1',
          contentType: 'application/custom.type1+json',
          url: 'http://localhost:3000/visualizator1',
        },
        {
          title: 'Visualizator 3',
          contentType: 'application/custom.type1+json',
          url: 'http://localhost:3000/visualizator3',
        },
      ],
      'application/custom.type2+json': [
        {
          title: 'Visualizator 2',
          contentType: 'application/custom.type2+json',
          url: 'http://localhost:3000/visualizator2',
        },
      ],
    });
  });

  it('should check for custom attachment type', () => {
    const selectIsCustomAttachmentType =
      SettingsSelectors.selectIsCustomAttachmentType(
        'application/custom.type1+json',
      );
    const result = selectIsCustomAttachmentType(mockState);
    expect(result).toBe(true);
  });
});
