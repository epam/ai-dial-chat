import { describe, expect, it } from 'vitest';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { QuickApp2Config } from '@/src/types/quick-apps';

import { getPendingAttachmentTypeError } from '@/src/constants/validation-helpers';

import {
  AppsEditorFormType,
  AppsEditorSchemaTypes,
  QuickApp2Schema,
  getApplicationPayload,
  getValidationSchema,
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
    locales: [],
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

const buildCustomAppFormData = (pendingInputAttachmentType: string) => ({
  type: AppsEditorSchemaTypes.CustomApp,
  inputAttachmentTypes: ['image/png'],
  pendingInputAttachmentType,
  completionUrl: 'http://application1/chat',
  features: null,
  name: 'Test app',
  version: '0.0.1',
  description: '',
  iconUrl: '',
  topics: [],
  locales: [],
});

const getAttachmentTypesErrors = (pendingInputAttachmentType: string) => {
  const result = getValidationSchema(AppsEditorSchemaTypes.CustomApp).safeParse(
    buildCustomAppFormData(pendingInputAttachmentType),
  );

  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path[0] === 'inputAttachmentTypes')
        .map((issue) => issue.message);
};

describe('getPendingAttachmentTypeError', () => {
  it('reports an invalid type that is being typed', () => {
    expect(getPendingAttachmentTypeError('imag')).toBe(
      'Please match the MIME format',
    );
  });

  it('reports nothing for a valid type', () => {
    expect(getPendingAttachmentTypeError('image/jpeg')).toBeUndefined();
  });

  it('reports nothing when nothing is being typed', () => {
    expect(getPendingAttachmentTypeError('')).toBeUndefined();
    expect(getPendingAttachmentTypeError('   ')).toBeUndefined();
    expect(getPendingAttachmentTypeError(undefined)).toBeUndefined();
  });
});

describe('Custom app schema - attachment type that is not added yet', () => {
  it('reports the MIME error while an invalid type is being typed', () => {
    expect(getAttachmentTypesErrors('imag')).toEqual([
      'Please match the MIME format',
    ]);
  });

  it('reports no error for a valid type that is being typed', () => {
    expect(getAttachmentTypesErrors('image/jpeg')).toEqual([]);
  });

  it('reports no error when nothing is being typed', () => {
    expect(getAttachmentTypesErrors('')).toEqual([]);
  });
});

const SKILL_ID = 'prompts/bucket/Skill_1';
const OTHER_SKILL_ID = 'prompts/bucket/Skill_2';

const buildQuickApp2Data = (
  agentSkills: string[],
  invalidAgentSkills: string[],
) => ({
  type: AppsEditorSchemaTypes.QuickApp2,
  instructions: 'Do the thing',
  temperature: 0.5,
  documentRelativeUrl: [],
  model: MODEL_ID,
  agentsAndToolsets: [],
  codeInterpreter: false,
  inputAttachmentTypes: [],
  pendingInputAttachmentType: '',
  isJsonView: false,
  agentsAndToolsetsJson: '[]',
  chatMessageInputDisabled: false,
  autoSubmit: false,
  starters: [],
  agentSkills,
  invalidAgentSkills,
  timestamp: false,
  fileTools: false,
  processLargeFiles: false,
  addAttachment: false,
  webFetch: false,
});

const getAgentSkillsErrors = (
  agentSkills: string[],
  invalidAgentSkills: string[],
) => {
  const result = QuickApp2Schema.safeParse(
    buildQuickApp2Data(agentSkills, invalidAgentSkills),
  );

  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path[0] === 'agentSkills')
        .map((issue) => issue.message);
};

describe('Quick App 2.0 schema - Agent Skills validation', () => {
  it('reports an error when a selected skill is invalid', () => {
    expect(getAgentSkillsErrors([SKILL_ID], [SKILL_ID])).toHaveLength(1);
  });

  it('reports no error when all selected skills are valid', () => {
    expect(getAgentSkillsErrors([SKILL_ID], [])).toEqual([]);
  });

  it('reports no error when there are no skills at all', () => {
    expect(getAgentSkillsErrors([], [])).toEqual([]);
  });

  it('ignores an invalid skill that is no longer selected', () => {
    expect(getAgentSkillsErrors([SKILL_ID], [OTHER_SKILL_ID])).toEqual([]);
  });

  it('reports an error when only one of several skills is invalid', () => {
    expect(
      getAgentSkillsErrors([SKILL_ID, OTHER_SKILL_ID], [OTHER_SKILL_ID]),
    ).toHaveLength(1);
  });
});

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
