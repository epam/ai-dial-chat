import { describe, expect, it } from 'vitest';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { QuickApp2Config } from '@/src/types/quick-apps';

import {
  AppsEditorFormType,
  AppsEditorSchemaTypes,
  getApplicationPayload,
} from '../form';

const MODEL_ID = 'gpt-4';

const buildEntitiesMap = (allowsTemperature: boolean) =>
  ({
    [MODEL_ID]: {
      id: MODEL_ID,
      features: { temperature: allowsTemperature },
    } as DialAIEntityModel,
  }) as Record<string, MarketplaceEntity>;

const buildFormData = (temperature: number): AppsEditorFormType =>
  ({
    type: AppsEditorSchemaTypes.QuickApp2,
    name: 'Test app',
    iconUrl: '',
    description: '',
    version: '0.0.1',
    topics: [],
    model: MODEL_ID,
    temperature,
    instructions: 'Do the thing',
    documentRelativeUrl: [],
    agentsAndToolsets: [],
    agentsAndToolsetsJson: '[]',
    isJsonView: false,
    codeInterpreter: false,
    inputAttachmentTypes: [],
    chatMessageInputDisabled: false,
    autoSubmit: false,
    starters: [],
    agentSkills: [],
    timestamp: false,
    fileTools: false,
    processLargeFiles: false,
  }) as unknown as AppsEditorFormType;

const getOrchestratorParameters = (
  temperature: number,
  allowsTemperature = true,
) =>
  (
    getApplicationPayload({
      data: buildFormData(temperature),
      allEntitiesMap: buildEntitiesMap(allowsTemperature),
    }).applicationProperties as QuickApp2Config
  ).orchestrator.deployment.parameters;

describe('getApplicationPayload - Quick App 2.0 orchestrator temperature', () => {
  it('saves a temperature of 0', () => {
    expect(getOrchestratorParameters(0)).toEqual({ temperature: 0 });
  });

  it('saves a non-zero temperature', () => {
    expect(getOrchestratorParameters(0.7)).toEqual({ temperature: 0.7 });
  });

  it('omits parameters when the model does not support temperature', () => {
    expect(getOrchestratorParameters(0.7, false)).toBeUndefined();
  });
});
