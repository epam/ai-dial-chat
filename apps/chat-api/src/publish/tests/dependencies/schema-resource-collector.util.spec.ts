import { describe, expect, it } from 'vitest';
import { collectSchemaResources } from '../../dependencies/schema-resource-collector.util';

/* A trimmed copy of the quick app schema's shape: discriminated unions behind `$ref`, `dial:resource` and `dial:file` markers. */
const SCHEMA = {
  $defs: {
    DialPromptSkillConfig: {
      properties: {
        type: { const: 'dial-prompt', type: 'string' },
        url: { 'dial:resource': true, type: 'string' },
      },
    },
    DialSkillConfig: {
      properties: {
        type: { const: 'dial-skill', type: 'string' },
        url: { 'dial:resource': true, type: 'string' },
      },
    },
    DialAppToolSet: {
      properties: {
        type: { const: 'dial-app', type: 'string' },
        deployment_id: { 'dial:resource': true, type: 'string' },
      },
    },
    DialMCPToolSet: {
      properties: {
        type: { const: 'dial-mcp', type: 'string' },
        deployment_id: { 'dial:resource': true, type: 'string' },
        dial_id: { 'dial:resource': true, type: 'string' },
      },
    },
    RestApiToolSet: {
      properties: {
        type: { const: 'rest-api', type: 'string' },
        url: { type: 'string' },
      },
    },
    FileContextConfig: {
      properties: {
        type: { const: 'file', type: 'string' },
        url: { 'dial:file': true, type: 'string' },
      },
    },
    DialDeploymentConfig: {
      properties: {
        deployment_id: { 'dial:resource': true, type: 'string' },
      },
    },
  },
  properties: {
    orchestrator: {
      properties: {
        deployment: { $ref: '#/$defs/DialDeploymentConfig' },
      },
    },
    /* Optional list, as the real schema declares it: the array is one level down, in an `anyOf` with null. */
    skills: {
      anyOf: [
        {
          type: 'array',
          items: {
            oneOf: [
              { $ref: '#/$defs/DialPromptSkillConfig' },
              { $ref: '#/$defs/DialSkillConfig' },
            ],
          },
        },
        { type: 'null' },
      ],
    },
    /* Optional marked string. */
    system_prompt_ref: {
      anyOf: [{ 'dial:resource': true, type: 'string' }, { type: 'null' }],
    },
    contexts: { items: { oneOf: [{ $ref: '#/$defs/FileContextConfig' }] } },
    tool_sets: {
      items: {
        oneOf: [
          { $ref: '#/$defs/DialAppToolSet' },
          { $ref: '#/$defs/DialMCPToolSet' },
          { $ref: '#/$defs/RestApiToolSet' },
        ],
      },
    },
  },
};

describe('collectSchemaResources', () => {
  it('collects dial-prompt and dial-skill urls', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        skills: [
          { type: 'dial-prompt', url: 'prompts/b/Greeting' },
          { type: 'dial-skill', url: 'skills/b/Docs' },
        ],
      }),
    ).toEqual(['prompts/b/Greeting', 'skills/b/Docs']);
  });

  it('collects skills declared as an optional list', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        skills: [{ type: 'dial-skill', url: 'skills/b/My skill' }],
      }),
    ).toEqual(['skills/b/My skill']);
  });

  it('collects an optional marked string and ignores it when null', () => {
    expect(
      collectSchemaResources(SCHEMA, { system_prompt_ref: 'prompts/b/P' }),
    ).toEqual(['prompts/b/P']);
    expect(
      collectSchemaResources(SCHEMA, { system_prompt_ref: null, skills: null }),
    ).toEqual([]);
  });

  it('collects the orchestrator deployment and the toolset deployments', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        orchestrator: { deployment: { deployment_id: 'gpt-4o' } },
        tool_sets: [
          { type: 'dial-app', deployment_id: 'applications/b/Calc__1.0.0' },
          { type: 'dial-mcp', deployment_id: 'toolsets/b/Search__1.0.0' },
        ],
      }),
    ).toEqual([
      'gpt-4o',
      'applications/b/Calc__1.0.0',
      'toolsets/b/Search__1.0.0',
    ]);
  });

  it('collects a legacy alias property that is also marked', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        tool_sets: [{ type: 'dial-mcp', dial_id: 'toolsets/b/Legacy__1.0.0' }],
      }),
    ).toEqual(['toolsets/b/Legacy__1.0.0']);
  });

  it('ignores a dial:file context', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        contexts: [{ type: 'file', url: 'files/b/notes.txt' }],
      }),
    ).toEqual([]);
  });

  it('ignores an entry whose type matches no branch', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        tool_sets: [{ type: 'unknown', deployment_id: 'applications/b/X' }],
      }),
    ).toEqual([]);
  });

  it('ignores an entry of a kind that holds no resource property', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        tool_sets: [{ type: 'rest-api', url: 'https://example.com' }],
      }),
    ).toEqual([]);
  });

  it('ignores an empty string, a missing value and a non-object value', () => {
    expect(
      collectSchemaResources(SCHEMA, {
        skills: [{ type: 'dial-prompt', url: '' }],
      }),
    ).toEqual([]);
    expect(collectSchemaResources(SCHEMA, undefined)).toEqual([]);
    expect(collectSchemaResources(SCHEMA, 'text')).toEqual([]);
  });

  it('stops on a schema whose branches refer to themselves', () => {
    const recursive = {
      $defs: { Loop: { oneOf: [{ $ref: '#/$defs/Loop' }] } },
      $ref: '#/$defs/Loop',
    };
    expect(collectSchemaResources(recursive, { a: 1 })).toEqual([]);
  });
});
