import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  AppsEditorClientMessage,
  AppsEditorHostMessage,
} from '../../models/apps-editor';
import {
  AppsEditorEvents,
  AppsEditorMessages,
} from '../../types/visualizer-connector';
import {
  parseAppsEditorClientMessage,
  parseAppsEditorHostMessage,
  serializeAppsEditorClientMessage,
} from '../apps-editor-protocol';

const NAME = 'Mind map [VPN required]';
const parse = (data: unknown) => parseAppsEditorClientMessage(data, NAME);

describe('application editor wire compatibility', () => {
  it.each([undefined, {}, { ignored: true }])(
    'accepts lifecycle signals with optional payload %j',
    (payload) => {
      expect(parse({ type: `${NAME}/readyToSave`, payload })).toEqual({
        type: AppsEditorEvents.ReadyToSave,
      });
    },
  );

  it.each([
    `${NAME}/READY`,
    `${NAME}/READY_TO_INTERACT`,
    `${NAME}/SEND_MESSAGE`,
    `${NAME}/SEND_VISUALIZE_DATA/RESPONSE`,
    `${NAME}/CREATED_CONVERSATION_SUCCESS`,
    'CodeApps/readyToSave',
    'readyToSave',
  ])('does not interpret %s as an editor state', (type) => {
    expect(parse({ type, payload: { isChanged: true } })).toBeNull();
  });

  it('preserves the prefixed application update payload from Loop and Mind Map', () => {
    const message: AppsEditorClientMessage = {
      type: AppsEditorEvents.UpdatedApplicationSuccess,
      payload: { application: { name: 'Map' } },
    };
    const wire = serializeAppsEditorClientMessage(message, NAME);
    expect(wire).toEqual({
      type: `${NAME}/updatedApplicationSuccess`,
      payload: { application: { name: 'Map' } },
    });
    expect(parse(wire)).toEqual(message);
  });

  it.each([undefined, false, 'true', 1, null])(
    'normalizes legacy hasChanges %j to false',
    (hasChanges) => {
      expect(
        parse({ type: AppsEditorMessages.SaveSuccess, hasChanges }),
      ).toEqual({
        type: AppsEditorMessages.SaveSuccess,
        hasChanges: false,
      });
    },
  );

  it('retains the boolean save change indicator', () => {
    expect(parse({ type: 'SAVE_SUCCESS', hasChanges: true })).toEqual({
      type: AppsEditorMessages.SaveSuccess,
      hasChanges: true,
    });
  });

  it.each([
    [{ error: 'Top level', payload: { error: 'Nested' } }, 'Top level'],
    [{ payload: { error: 'Nested' } }, 'Nested'],
    [{}, ''],
    [{ error: '' }, ''],
  ])('normalizes save error placement %j', (fields, error) => {
    expect(parse({ type: AppsEditorMessages.SaveError, ...fields })).toEqual({
      type: AppsEditorMessages.SaveError,
      error,
    });
  });

  it.each([
    { isDirty: true },
    { payload: { isDirty: true } },
    { payload: { isDirty: null }, isDirty: true },
  ])('accepts existing dirty-state placement %j', (fields) => {
    expect(parse({ type: AppsEditorMessages.DirtyState, ...fields })).toEqual({
      type: AppsEditorMessages.DirtyState,
      payload: { isDirty: true },
    });
  });

  it.each([
    null,
    [],
    'readyToSave',
    { type: 'DIRTY_STATE', payload: { isChanged: true } },
    { type: 'DIRTY_STATE', payload: { isDirty: 'false' }, isDirty: true },
    { type: 'VALIDITY_STATE', payload: { isValid: 1 } },
    { type: 'VALIDITY_STATE', isValid: true },
    { type: 'SAVE_ERROR', error: { message: 'failure' } },
    { type: 'REQUEST_TOOLSET_LOGIN', toolsetId: '' },
    { type: 'REQUEST_TOOLSET_LOGOUT', toolsetId: 1 },
    { type: 'REQUEST_APPLICATION_CREDENTIALS' },
    { type: 'TRIGGER_SAVE' },
    { type: 'TOOLSET_LOGIN_RESULT', toolsetId: 'id', success: true },
  ])('rejects malformed or wrong-direction editor message %j', (message) => {
    expect(parse(message)).toBeNull();
  });

  it('accepts save requests without General data and leaves domain bodies opaque', () => {
    expect(parseAppsEditorHostMessage({ type: 'TRIGGER_SAVE' })).toEqual({
      type: AppsEditorMessages.TriggerSave,
      general: undefined,
    });
    const general = {
      name: 'App',
      locales: [{ language: 'pl', name: 'Mapa' }],
    };
    expect(
      parseAppsEditorHostMessage({ type: 'TRIGGER_SAVE', general }),
    ).toEqual({
      type: AppsEditorMessages.TriggerSave,
      general,
    });
  });

  it.each(['TOOLSET_LOGIN_RESULT', 'TOOLSET_LOGOUT_RESULT'])(
    'preserves %s result fields and application-owned status',
    (type) => {
      const message = {
        type,
        toolsetId: 'tool set',
        success: true,
        credentialsLevel: 'APP',
        reason: undefined,
        credentials: { user: 'SIGNED_IN' },
      };
      expect(parseAppsEditorHostMessage(message)).toEqual(message);
    },
  );

  it.each([
    null,
    [],
    { type: 'SAVE_SUCCESS' },
    { type: `${NAME}/readyToSave` },
    { type: 'TOOLSET_LOGIN_RESULT', toolsetId: 'id', success: 'true' },
    { type: 'TOOLSET_LOGOUT_RESULT', toolsetId: '', success: true },
    {
      type: 'TOOLSET_LOGIN_RESULT',
      toolsetId: 'id',
      success: true,
      reason: 42,
    },
    {
      type: 'TOOLSET_LOGIN_RESULT',
      toolsetId: 'id',
      success: true,
      credentialsLevel: false,
    },
  ])('rejects malformed or wrong-direction host message %j', (message) => {
    expect(parseAppsEditorHostMessage(message)).toBeNull();
  });

  it('binds each direction and event to its data shape', () => {
    expectTypeOf<{
      type: AppsEditorMessages.TriggerSave;
    }>().toExtend<AppsEditorHostMessage>();
    expectTypeOf<{
      type: AppsEditorMessages.TriggerSave;
    }>().not.toExtend<AppsEditorClientMessage>();
    expectTypeOf<{
      type: AppsEditorMessages.DirtyState;
      payload: { isDirty: boolean };
    }>().toExtend<AppsEditorClientMessage>();
    expectTypeOf<{
      type: AppsEditorMessages.DirtyState;
      payload: { isChanged: boolean };
    }>().not.toExtend<AppsEditorClientMessage>();
    expectTypeOf<{
      type: AppsEditorMessages.SaveError;
    }>().not.toExtend<AppsEditorClientMessage>();
  });
});
