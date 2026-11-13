import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACKAGE_VERSION } from '../../../common/utils/app-version';
import { EnvironmentVariables } from '../../../config/environment.config';
import { CONFIG_DEFINITIONS } from '../../config-registry/config-registry.constants';
import {
  DERIVED_CASES,
  ENV_KEY_CASES,
  EnvCaseName,
  PARSER_CASES,
  ROLE_GATE_CASES,
  SCENARIO_VARIABLES,
  buildResolutionStack,
  envForCase,
  resolveOutcome,
  type Outcome,
} from './env-resolution.fixtures';

/*
 * Characterization of ENV resolution, recorded before explicit ENV presence
 * and the admission/capability/role-gate seams were introduced. Each row is
 * what the provider returned and what a caller observed (client-config field
 * or `isEnabled`) for one raw environment. The effective values must never
 * change in this refactor. Provider-level values changed twice, on purpose:
 * - since explicit ENV presence, a variable that only holds its typed default
 *   resolves to `undefined` at the provider (rows `absent` and `unset`), so
 *   the registry default applies one step later;
 * - since role gating moved after selection into AppConfigService, the
 *   provider returns the ungated value for a restricted or anonymous caller
 *   (role-gate rows with `roles beta`), and the gate turns it off later;
 * - a blank managed text (`empty` rows of `announcement.title`,
 *   `announcement.description` and `welcomeScreen.description`) resolves to
 *   `undefined` at the provider instead of `''`, so it cannot shadow a
 *   lower-priority source; the client mapping hides blank and null alike.
 * The effective value of every row is the one recorded before both changes.
 */

type LoggedOutcome = Outcome & { readonly logs?: readonly string[] };

const KEY_EXPECTATIONS: Readonly<
  Record<string, Partial<Record<EnvCaseName, Outcome>>>
> = {
  'asr.modelId': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: { provider: 'whisper-1', effective: 'whisper-1' },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'asr.transcribeSizeLimitBytes': {
    [EnvCaseName.Absent]: { provider: undefined, effective: 5242880 },
    [EnvCaseName.TypedDefault]: { provider: 5242880, effective: 5242880 },
    [EnvCaseName.NonDefault]: { provider: 10485760, effective: 10485760 },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nTRANSCRIBE_SIZE_LIMIT_BYTES must not be less than 1',
    },
  },
  customVariables: {
    [EnvCaseName.Absent]: { provider: undefined, effective: {} },
    [EnvCaseName.NonDefault]: {
      provider: { label: 'Example', count: 3 },
      effective: { label: 'Example', count: 3 },
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: {} },
  },
  'deployments.defaultDeploymentId': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: { provider: 'gpt-4o', effective: 'gpt-4o' },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'dialCore.externalUrl': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: {
      provider: 'https://core.example.com',
      effective: 'https://core.example.com',
    },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'mcpApps.sandboxUrl': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: {
      provider: 'https://sandbox.example.com',
      effective: 'https://sandbox.example.com',
    },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nMCP_APP_SANDBOX_URL must be a URL address',
    },
  },
  'mcpApps.theme': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: { provider: 'dark', effective: 'dark' },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nMCP_APP_THEME must match /^(light|dark)$/ regular expression',
    },
  },
  'mcpApps.userAgent': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: { provider: 'DIAL Chat', effective: 'DIAL Chat' },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'mcpApps.hostName': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: { provider: 'dial-chat', effective: 'dial-chat' },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'app.version': {
    [EnvCaseName.Absent]: { provider: undefined, effective: PACKAGE_VERSION },
    [EnvCaseName.NonDefault]: { provider: '9.9.9', effective: '9.9.9' },
    [EnvCaseName.Empty]: { provider: '', effective: PACKAGE_VERSION },
  },
  'announcement.html': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: {
      provider: '<b>Hello</b>',
      effective: '<b>Hello</b>',
    },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'announcement.title': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: {
      provider: ' Maintenance ',
      effective: 'Maintenance',
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: null },
  },
  'announcement.description': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: {
      provider: 'Tonight <script>x</script><b>only</b>',
      effective: 'Tonight <b>only</b>',
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: null },
  },
  'announcement.items': {
    [EnvCaseName.Absent]: { provider: undefined, effective: [] },
    [EnvCaseName.NonDefault]: {
      provider: [
        { title: 'A', link: { label: 'Read', href: 'https://a.example.com' } },
      ],
      effective: [
        {
          title: 'A',
          description: null,
          link: { label: 'Read', href: 'https://a.example.com' },
          severity: 'info',
        },
      ],
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: [] },
  },
  'welcomeScreen.description': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: { provider: 'Welcome', effective: 'Welcome' },
    [EnvCaseName.Empty]: { provider: undefined, effective: null },
  },
  'footer.html': {
    [EnvCaseName.Absent]: { provider: undefined, effective: '' },
    [EnvCaseName.NonDefault]: {
      provider: 'Build %%VERSION%%',
      effective: `Build ${PACKAGE_VERSION}`,
    },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'utility.modelId': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: {
      provider: 'gpt-4o-mini',
      effective: 'gpt-4o-mini',
    },
    [EnvCaseName.Empty]: { provider: '', effective: '' },
  },
  'features.responsesApiEnabled': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'features.responsesBackgroundEnabled': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'ui.activeEventId': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: { provider: 'halloween', effective: 'halloween' },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nUI_EVENT must be a lowercase kebab-case event ID or none',
    },
  },
  'ui.celebrationsEnabledByDefault': {
    [EnvCaseName.Absent]: { provider: undefined, effective: true },
    [EnvCaseName.TypedDefault]: { provider: true, effective: true },
    [EnvCaseName.NonDefault]: { provider: false, effective: false },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'ui.celebrationDelivery.mode': {
    [EnvCaseName.Absent]: { provider: undefined, effective: 'bundled' },
    [EnvCaseName.TypedDefault]: { provider: 'bundled', effective: 'bundled' },
    [EnvCaseName.NonDefault]: {
      provider: 'prefer-external',
      effective: 'prefer-external',
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: 'bundled' },
  },
  'ui.celebrationDelivery.revision': {
    [EnvCaseName.Absent]: { provider: undefined, effective: '0' },
    [EnvCaseName.TypedDefault]: { provider: '0', effective: '0' },
    [EnvCaseName.NonDefault]: { provider: '7', effective: '7' },
    [EnvCaseName.Empty]: { provider: undefined, effective: '0' },
  },
  'ui.celebrationDelivery.externalScenes': {
    [EnvCaseName.Absent]: { provider: undefined, effective: [] },
    [EnvCaseName.TypedDefault]: { provider: undefined, effective: [] },
    [EnvCaseName.NonDefault]: {
      provider: ['halloween/pumpkin'],
      effective: [{ eventId: 'halloween', sceneId: 'pumpkin' }],
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: [] },
  },
  'ui.celebrationDelivery.externalEvents': {
    [EnvCaseName.Absent]: { provider: undefined, effective: [] },
    [EnvCaseName.TypedDefault]: { provider: undefined, effective: [] },
    [EnvCaseName.NonDefault]: { provider: ['diwali'], effective: ['diwali'] },
    [EnvCaseName.Empty]: { provider: undefined, effective: [] },
  },
  'overlay.enabled': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'documents.allowedConnectOrigins': {
    [EnvCaseName.Absent]: { provider: undefined, effective: [] },
    [EnvCaseName.TypedDefault]: { provider: [], effective: [] },
    [EnvCaseName.NonDefault]: {
      provider: ['https://documents.example.com'],
      effective: ['https://documents.example.com'],
    },
    [EnvCaseName.Empty]: { provider: [], effective: [] },
  },
  'overlay.allowedOrigins': {
    [EnvCaseName.Absent]: { provider: undefined, effective: [] },
    [EnvCaseName.TypedDefault]: { provider: [], effective: [] },
    [EnvCaseName.NonDefault]: {
      provider: ['https://host.example.com'],
      effective: ['https://host.example.com'],
    },
    [EnvCaseName.Empty]: { provider: [], effective: [] },
  },
  'fileManager.availableTabs': {
    [EnvCaseName.Absent]: {
      provider: undefined,
      effective: ['all', 'my_files', 'shared', 'organization'],
    },
    [EnvCaseName.TypedDefault]: {
      provider: undefined,
      effective: ['all', 'my_files', 'shared', 'organization'],
    },
    [EnvCaseName.NonDefault]: {
      provider: ['shared', 'my_files'],
      effective: ['shared', 'my_files'],
    },
    [EnvCaseName.Empty]: {
      provider: undefined,
      effective: ['all', 'my_files', 'shared', 'organization'],
    },
  },
  'features.liveChatInteraction': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'features.scheduledTasksEnabled': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'features.projectsEnabled': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'features.defaultDeploymentPinned': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'features.visualizerSendMessages': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: false, effective: false },
  },
  'features.usageLimitsControl': {
    [EnvCaseName.Absent]: { provider: undefined, effective: false },
    [EnvCaseName.TypedDefault]: { provider: false, effective: false },
    [EnvCaseName.NonDefault]: { provider: true, effective: true },
    [EnvCaseName.Empty]: { provider: true, effective: true },
  },
  'uiFeatures.enabledUiFeatures': {
    [EnvCaseName.Absent]: { provider: undefined, effective: null },
    [EnvCaseName.TypedDefault]: { provider: undefined, effective: null },
    [EnvCaseName.NonDefault]: {
      provider: ['likes', 'input-files'],
      effective: ['likes', 'input-files'],
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: null },
  },
  customVisualizers: {
    [EnvCaseName.Absent]: { provider: undefined, effective: [] },
    [EnvCaseName.NonDefault]: {
      provider: [
        {
          title: 'Viz',
          contentType: 'text/x-viz',
          url: 'https://viz.example.com',
        },
      ],
      effective: [
        {
          title: 'Viz',
          contentType: 'text/x-viz',
          url: 'https://viz.example.com',
        },
      ],
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: [] },
  },
  applicationVisualizers: {
    [EnvCaseName.Absent]: { provider: undefined, effective: {} },
    [EnvCaseName.NonDefault]: {
      provider: { 'app-1': { title: 'Viz', url: 'https://viz.example.com' } },
      effective: { 'app-1': { title: 'Viz', url: 'https://viz.example.com' } },
    },
    [EnvCaseName.Empty]: { provider: undefined, effective: {} },
  },
  'publish.publicationFilterSources': {
    [EnvCaseName.Absent]: {
      provider: undefined,
      effective: ['title', 'role', 'dial_roles'],
    },
    [EnvCaseName.TypedDefault]: {
      provider: undefined,
      effective: ['title', 'role', 'dial_roles'],
    },
    [EnvCaseName.NonDefault]: {
      provider: ['title', 'department'],
      effective: ['title', 'department'],
    },
    [EnvCaseName.Empty]: {
      provider: undefined,
      effective: ['title', 'role', 'dial_roles'],
    },
  },
  'content.additionalLocales': {
    [EnvCaseName.Absent]: { provider: undefined, effective: [] },
    [EnvCaseName.NonDefault]: {
      provider: ['de-DE', 'fr'],
      effective: ['de-DE', 'fr'],
    },
    [EnvCaseName.Empty]: { provider: [], effective: [] },
  },
  'attachments.maxFileSizeBytes': {
    [EnvCaseName.Absent]: { provider: undefined, effective: 536870912 },
    [EnvCaseName.TypedDefault]: { provider: 536870912, effective: 536870912 },
    [EnvCaseName.NonDefault]: { provider: 1048576, effective: 1048576 },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nFILE_UPLOAD_MAX_BYTES must not be less than 1',
    },
  },
  'projects.contextFileMaxBytes': {
    [EnvCaseName.Absent]: { provider: undefined, effective: 1048576 },
    [EnvCaseName.TypedDefault]: { provider: 1048576, effective: 1048576 },
    [EnvCaseName.NonDefault]: { provider: 2048, effective: 2048 },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nPROJECT_CONTEXT_FILE_MAX_BYTES must not be less than 1',
    },
  },
  'projects.contextTotalMaxBytes': {
    [EnvCaseName.Absent]: { provider: undefined, effective: 10485760 },
    [EnvCaseName.TypedDefault]: { provider: 10485760, effective: 10485760 },
    [EnvCaseName.NonDefault]: { provider: 4194304, effective: 4194304 },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nPROJECT_CONTEXT_TOTAL_MAX_BYTES must not be less than 1',
    },
  },
  'projects.contextAllowedExtensions': {
    [EnvCaseName.Absent]: {
      provider: undefined,
      effective: ['csv', 'pdf', 'xlsx'],
    },
    [EnvCaseName.TypedDefault]: {
      provider: ['csv', 'pdf', 'xlsx'],
      effective: ['csv', 'pdf', 'xlsx'],
    },
    [EnvCaseName.NonDefault]: {
      provider: ['md', 'txt'],
      effective: ['md', 'txt'],
    },
    [EnvCaseName.Empty]: {
      provider: ['csv', 'pdf', 'xlsx'],
      effective: ['csv', 'pdf', 'xlsx'],
    },
  },
  'usageLimits.warningThresholdPercent': {
    [EnvCaseName.Absent]: { provider: undefined, effective: 75 },
    [EnvCaseName.TypedDefault]: { provider: 75, effective: 75 },
    [EnvCaseName.NonDefault]: { provider: 80, effective: 80 },
    [EnvCaseName.Empty]: {
      bootError:
        'Environment validation failed:\nUSAGE_LIMITS_WARNING_THRESHOLD_PERCENT must not be less than 1',
    },
  },
};

const ROLE_GATE_EXPECTATIONS: Readonly<Record<string, Outcome>> = {
  'features.asrEnabled model set, no roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.asrEnabled model set, no roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.asrEnabled model set, no roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.asrEnabled model set, empty roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.asrEnabled model set, empty roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.asrEnabled model set, empty roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.asrEnabled model set, roles beta, allowed': {
    provider: true,
    effective: true,
  },
  'features.asrEnabled model set, roles beta, restricted': {
    provider: true,
    effective: false,
  },
  'features.asrEnabled model set, roles beta, anonymous': {
    provider: true,
    effective: false,
  },
  'features.asrEnabled model unset, no roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, no roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, no roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, empty roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, empty roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, empty roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, roles beta, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, roles beta, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled model unset, roles beta, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction enabled, no roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.liveChatInteraction enabled, no roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.liveChatInteraction enabled, no roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.liveChatInteraction enabled, empty roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.liveChatInteraction enabled, empty roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.liveChatInteraction enabled, empty roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.liveChatInteraction enabled, roles beta, allowed': {
    provider: true,
    effective: true,
  },
  'features.liveChatInteraction enabled, roles beta, restricted': {
    provider: true,
    effective: false,
  },
  'features.liveChatInteraction enabled, roles beta, anonymous': {
    provider: true,
    effective: false,
  },
  'features.liveChatInteraction disabled, no roles, allowed': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, no roles, restricted': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, no roles, anonymous': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, empty roles, allowed': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, empty roles, restricted': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, empty roles, anonymous': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, roles beta, allowed': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, roles beta, restricted': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction disabled, roles beta, anonymous': {
    provider: false,
    effective: false,
  },
  'features.liveChatInteraction unset, no roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, no roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, no roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, empty roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, empty roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, empty roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, roles beta, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, roles beta, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.liveChatInteraction unset, roles beta, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled enabled, no roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.scheduledTasksEnabled enabled, no roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.scheduledTasksEnabled enabled, no roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.scheduledTasksEnabled enabled, empty roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.scheduledTasksEnabled enabled, empty roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.scheduledTasksEnabled enabled, empty roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.scheduledTasksEnabled enabled, roles beta, allowed': {
    provider: true,
    effective: true,
  },
  'features.scheduledTasksEnabled enabled, roles beta, restricted': {
    provider: true,
    effective: false,
  },
  'features.scheduledTasksEnabled enabled, roles beta, anonymous': {
    provider: true,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, no roles, allowed': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, no roles, restricted': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, no roles, anonymous': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, empty roles, allowed': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, empty roles, restricted': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, empty roles, anonymous': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, roles beta, allowed': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, roles beta, restricted': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled disabled, roles beta, anonymous': {
    provider: false,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, no roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, no roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, no roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, empty roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, empty roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, empty roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, roles beta, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, roles beta, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.scheduledTasksEnabled unset, roles beta, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled enabled, no roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.projectsEnabled enabled, no roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.projectsEnabled enabled, no roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.projectsEnabled enabled, empty roles, allowed': {
    provider: true,
    effective: true,
  },
  'features.projectsEnabled enabled, empty roles, restricted': {
    provider: true,
    effective: true,
  },
  'features.projectsEnabled enabled, empty roles, anonymous': {
    provider: true,
    effective: true,
  },
  'features.projectsEnabled enabled, roles beta, allowed': {
    provider: true,
    effective: true,
  },
  'features.projectsEnabled enabled, roles beta, restricted': {
    provider: true,
    effective: false,
  },
  'features.projectsEnabled enabled, roles beta, anonymous': {
    provider: true,
    effective: false,
  },
  'features.projectsEnabled disabled, no roles, allowed': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, no roles, restricted': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, no roles, anonymous': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, empty roles, allowed': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, empty roles, restricted': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, empty roles, anonymous': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, roles beta, allowed': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, roles beta, restricted': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled disabled, roles beta, anonymous': {
    provider: false,
    effective: false,
  },
  'features.projectsEnabled unset, no roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, no roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, no roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, empty roles, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, empty roles, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, empty roles, anonymous': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, roles beta, allowed': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, roles beta, restricted': {
    provider: undefined,
    effective: false,
  },
  'features.projectsEnabled unset, roles beta, anonymous': {
    provider: undefined,
    effective: false,
  },
};

const DERIVED_EXPECTATIONS: Readonly<Record<string, Outcome>> = {
  'features.asrEnabled ASR_MODEL absent': {
    provider: undefined,
    effective: false,
  },
  'features.asrEnabled ASR_MODEL set': { provider: true, effective: true },
  'features.asrEnabled ASR_MODEL empty': { provider: true, effective: true },
  'features.llmConversationNaming nothing set': {
    provider: undefined,
    effective: false,
  },
  'features.llmConversationNaming opt-in only': {
    provider: undefined,
    effective: false,
  },
  'features.llmConversationNaming model and key, no opt-in': {
    provider: false,
    effective: false,
  },
  'features.llmConversationNaming model, key and opt-in': {
    provider: true,
    effective: true,
  },
  'features.llmConversationNaming model, key and opt-out': {
    provider: false,
    effective: false,
  },
  'features.llmConversationNaming key and opt-in, no model': {
    provider: undefined,
    effective: false,
  },
  'features.llmConversationNaming model and opt-in, no key': {
    provider: undefined,
    effective: false,
  },
  'features.llmConversationNaming empty model with key and opt-in': {
    provider: undefined,
    effective: false,
  },
  'features.footer FOOTER_HTML_MESSAGE absent': {
    provider: undefined,
    effective: false,
  },
  'features.footer FOOTER_HTML_MESSAGE set': {
    provider: true,
    effective: true,
  },
  'features.footer FOOTER_HTML_MESSAGE empty': {
    provider: true,
    effective: true,
  },
};

const PARSER_EXPECTATIONS: Readonly<Record<string, LoggedOutcome>> = {
  'announcement.items absent': { provider: undefined, effective: [], logs: [] },
  'announcement.items empty': { provider: undefined, effective: [], logs: [] },
  'announcement.items valid': {
    provider: [
      {
        title: 'A',
        description: '<b>B</b>',
        link: { label: 'Read', href: 'https://a.example.com' },
      },
    ],
    effective: [
      {
        title: 'A',
        description: '<b>B</b>',
        link: { label: 'Read', href: 'https://a.example.com' },
        severity: 'info',
      },
    ],
    logs: [],
  },
  'announcement.items invalid JSON': {
    provider: undefined,
    effective: [],
    logs: [
      'error: ANNOUNCEMENTS is not valid JSON; resolving to an empty list',
    ],
  },
  'announcement.items not an array': {
    provider: undefined,
    effective: [],
    logs: [
      'error: ANNOUNCEMENTS must be a JSON array; resolving to an empty list',
    ],
  },
  'announcement.items mixed entries': {
    provider: [
      { title: ' ' },
      { title: 'Ok' },
      { title: 'Bad link', link: { label: 'x', href: 'javascript:alert(1)' } },
      'text',
    ],
    effective: [
      { title: 'Ok', description: null, link: null, severity: 'info' },
    ],
    logs: [
      'warn: Ignoring announcement entry with a blank or missing title',
      'warn: Ignoring announcement "Bad link": link.href is not an http(s) URL: javascript:alert(1)',
      'warn: Ignoring announcement entry that is not an object',
    ],
  },
  'customVariables absent': { provider: undefined, effective: {}, logs: [] },
  'customVariables empty': { provider: undefined, effective: {}, logs: [] },
  'customVariables blank': { provider: undefined, effective: {}, logs: [] },
  'customVariables valid': {
    provider: { a: 1, nested: { b: [true, null] } },
    effective: { a: 1, nested: { b: [true, null] } },
    logs: [],
  },
  'customVariables invalid JSON': {
    provider: undefined,
    effective: {},
    logs: [
      'warn: CUSTOM_CLIENT_VARIABLES must be a JSON object; using an empty object',
    ],
  },
  'customVariables array': {
    provider: undefined,
    effective: {},
    logs: [
      'warn: CUSTOM_CLIENT_VARIABLES must be a JSON object; using an empty object',
    ],
  },
  'customVariables null': {
    provider: undefined,
    effective: {},
    logs: [
      'warn: CUSTOM_CLIENT_VARIABLES must be a JSON object; using an empty object',
    ],
  },
  'customVisualizers absent': { provider: undefined, effective: [], logs: [] },
  'customVisualizers empty': { provider: undefined, effective: [], logs: [] },
  'customVisualizers valid': {
    provider: [
      {
        title: 'Viz',
        contentType: 'text/x-viz',
        url: 'https://viz.example.com',
        width: 300,
      },
    ],
    effective: [
      {
        title: 'Viz',
        contentType: 'text/x-viz',
        url: 'https://viz.example.com',
        width: 300,
      },
    ],
    logs: [],
  },
  'customVisualizers invalid JSON': {
    provider: [],
    effective: [],
    logs: [
      'error: CUSTOM_VISUALIZERS is not valid JSON; resolving to an empty registry',
    ],
  },
  'customVisualizers not an array': {
    provider: [],
    effective: [],
    logs: [
      'error: CUSTOM_VISUALIZERS must be a JSON array; resolving to an empty registry',
    ],
  },
  'customVisualizers mixed entries': {
    provider: [
      { title: 'Viz', contentType: 'text/x', url: 'https://c.example.com' },
    ],
    effective: [
      { title: 'Viz', contentType: 'text/x', url: 'https://c.example.com' },
    ],
    logs: [
      'error: CUSTOM_VISUALIZERS[0] is not an object; dropping entry',
      'error: CUSTOM_VISUALIZERS[1] failed validation, dropping entry: title should not be empty',
      'error: CUSTOM_VISUALIZERS[2] has no usable MIME type in "contentType"; dropping entry',
      'warn: CUSTOM_VISUALIZERS[3] contains unrecognized fields that will be ignored: development',
    ],
  },
  'applicationVisualizers absent': {
    provider: undefined,
    effective: {},
    logs: [],
  },
  'applicationVisualizers empty': {
    provider: undefined,
    effective: {},
    logs: [],
  },
  'applicationVisualizers valid': {
    provider: {
      'app-1': {
        title: 'Viz',
        url: 'https://viz.example.com',
        borderless: true,
      },
    },
    effective: {
      'app-1': {
        title: 'Viz',
        url: 'https://viz.example.com',
        borderless: true,
      },
    },
    logs: [],
  },
  'applicationVisualizers invalid JSON': {
    provider: {},
    effective: {},
    logs: [
      'error: APPLICATION_VISUALIZERS is not valid JSON; resolving to an empty registry',
    ],
  },
  'applicationVisualizers array': {
    provider: {},
    effective: {},
    logs: [
      'error: APPLICATION_VISUALIZERS must be a JSON object keyed by application id; resolving to an empty registry',
    ],
  },
  'applicationVisualizers mixed entries': {
    provider: { d: { title: 'Viz', url: 'https://other.example.org' } },
    effective: { d: { title: 'Viz', url: 'https://other.example.org' } },
    logs: [
      'error: APPLICATION_VISUALIZERS["a"] is not an object; dropping entry',
      'error: APPLICATION_VISUALIZERS["b"] failed validation, dropping entry: title should not be empty',
      'error: APPLICATION_VISUALIZERS["c"] has no usable MIME type in "contentType"; dropping entry',
      'warn: APPLICATION_VISUALIZERS["d"] contains unrecognized fields that will be ignored: expanded',
      'warn: APPLICATION_VISUALIZERS["d"] points at https://other.example.org, which is not listed in ALLOWED_IFRAME_ORIGINS; the browser will block the iframe unless that URL is same-origin with the app',
    ],
  },
  'fileManager.availableTabs absent': {
    provider: undefined,
    effective: ['all', 'my_files', 'shared', 'organization'],
    logs: [],
  },
  'fileManager.availableTabs empty': {
    provider: undefined,
    effective: ['all', 'my_files', 'shared', 'organization'],
    logs: [],
  },
  'fileManager.availableTabs valid': {
    provider: ['organization', 'all'],
    effective: ['organization', 'all'],
    logs: [],
  },
  'fileManager.availableTabs partly unknown': {
    provider: ['shared'],
    effective: ['shared'],
    logs: [],
  },
  'fileManager.availableTabs all unknown': {
    provider: undefined,
    effective: ['all', 'my_files', 'shared', 'organization'],
    logs: [],
  },
  'fileManager.availableTabs separators only': {
    provider: undefined,
    effective: ['all', 'my_files', 'shared', 'organization'],
    logs: [],
  },
  'publish.publicationFilterSources absent': {
    provider: undefined,
    effective: ['title', 'role', 'dial_roles'],
    logs: [],
  },
  'publish.publicationFilterSources empty': {
    provider: undefined,
    effective: ['title', 'role', 'dial_roles'],
    logs: [],
  },
  'publish.publicationFilterSources valid': {
    provider: ['title', 'department'],
    effective: ['title', 'department'],
    logs: [],
  },
  'publish.publicationFilterSources separators only': {
    provider: undefined,
    effective: ['title', 'role', 'dial_roles'],
    logs: [],
  },
  'content.additionalLocales absent': {
    provider: undefined,
    effective: [],
    logs: [],
  },
  'content.additionalLocales empty': { provider: [], effective: [], logs: [] },
  'content.additionalLocales valid': {
    provider: ['de-DE', 'fr'],
    effective: ['de-DE', 'fr'],
    logs: [],
  },
  'content.additionalLocales malformed': {
    bootError:
      'Environment validation failed:\nADDITIONAL_CONTENT_LOCALES must be a comma-separated list of BCP-47 language tags (e.g. de,fr-FR,pt-BR), each value in ADDITIONAL_CONTENT_LOCALES must match /^[A-Za-z0-9-]+$/ regular expression',
    logs: [],
  },
  'content.additionalLocales legacy only (AVAILABLE_LOCALES)': {
    provider: ['ar', 'en'],
    effective: ['ar', 'en'],
    logs: [
      'warn: AVAILABLE_LOCALES is deprecated; rename it to ADDITIONAL_CONTENT_LOCALES. It is read only while ADDITIONAL_CONTENT_LOCALES is unset.',
    ],
  },
  'content.additionalLocales legacy empty (AVAILABLE_LOCALES)': {
    provider: [],
    effective: [],
    logs: [
      'warn: AVAILABLE_LOCALES is deprecated; rename it to ADDITIONAL_CONTENT_LOCALES. It is read only while ADDITIONAL_CONTENT_LOCALES is unset.',
    ],
  },
  'content.additionalLocales both set': {
    provider: ['fr'],
    effective: ['fr'],
    logs: [],
  },
  'content.additionalLocales new empty, legacy set': {
    provider: [],
    effective: [],
    logs: [],
  },
};

/*
 * Variables whose class initializer differs from the registry default on
 * purpose: the ENV provider resolves the initializer as "not set", so the
 * registry default applies.
 */
const INITIALIZERS_RESOLVED_AS_UNSET: ReadonlyMap<string, string> = new Map([
  ['FILE_MANAGER_AVAILABLE_TABS', 'an empty tab list falls back to every tab'],
  [
    'PUBLICATION_FILTER_SOURCES',
    'an empty source list falls back to the legacy default',
  ],
  ['ENABLED_UI_FEATURES', 'null means the compiled-in UI feature baseline'],
]);

describe('ENV resolution characterization', () => {
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;
    for (const variable of SCENARIO_VARIABLES) {
      vi.stubEnv(variable, undefined);
    }
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation((message) => {
      logs.push(`warn: ${String(message)}`);
    });
    vi.spyOn(Logger.prototype, 'error').mockImplementation((message) => {
      logs.push(`error: ${String(message)}`);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('covers every registry key that reads a variable of its own', () => {
    expect(ENV_KEY_CASES.map((entry) => entry.key).sort()).toEqual(
      CONFIG_DEFINITIONS.filter((definition) => definition.envVar)
        .map((definition) => definition.key)
        .sort(),
    );
    for (const entry of ENV_KEY_CASES) {
      expect(
        CONFIG_DEFINITIONS.find((definition) => definition.key === entry.key)
          ?.envVar,
      ).toBe(entry.variable);
    }
  });

  describe.each(ENV_KEY_CASES)('$key ($variable)', (entry) => {
    it.each(Object.values(EnvCaseName))('%s', async (name) => {
      const env = envForCase(entry, name);
      const expected = KEY_EXPECTATIONS[entry.key]?.[name];
      if (env === undefined) {
        expect(expected).toBeUndefined();
        return;
      }
      expect(await resolveOutcome(env, entry.key)).toEqual(expected);
    });
  });

  it.each(ROLE_GATE_CASES)('role gate: $name', async (scenario) => {
    expect(
      await resolveOutcome(scenario.env, scenario.key, scenario.context),
    ).toEqual(ROLE_GATE_EXPECTATIONS[scenario.name]);
  });

  it.each(DERIVED_CASES)('derived: $name', async (scenario) => {
    expect(
      await resolveOutcome(scenario.env, scenario.key, scenario.context),
    ).toEqual(DERIVED_EXPECTATIONS[scenario.name]);
  });

  it.each(PARSER_CASES)('parser: $name', async (scenario) => {
    expect(
      await resolveOutcome(
        scenario.env,
        scenario.key,
        scenario.context,
        () => logs,
      ),
    ).toEqual(PARSER_EXPECTATIONS[scenario.name]);
  });

  it('records every scenario exactly once', () => {
    expect(Object.keys(ROLE_GATE_EXPECTATIONS).sort()).toEqual(
      ROLE_GATE_CASES.map((scenario) => scenario.name).sort(),
    );
    expect(Object.keys(DERIVED_EXPECTATIONS).sort()).toEqual(
      DERIVED_CASES.map((scenario) => scenario.name).sort(),
    );
    expect(Object.keys(PARSER_EXPECTATIONS).sort()).toEqual(
      PARSER_CASES.map((scenario) => scenario.name).sort(),
    );
  });

  describe('typed-default parity', () => {
    const initialized = new EnvironmentVariables() as unknown as Record<
      string,
      unknown
    >;
    const withInitializer = CONFIG_DEFINITIONS.filter(
      (definition) =>
        definition.envVar !== undefined &&
        initialized[definition.envVar] !== undefined,
    );

    it('finds the variables that declare an initializer', () => {
      expect(withInitializer.length).toBeGreaterThan(0);
    });

    it.each(withInitializer)(
      '$key: the $envVar initializer equals the registry default',
      async (definition) => {
        const variable = definition.envVar as string;
        const reason = INITIALIZERS_RESOLVED_AS_UNSET.get(variable);
        if (reason === undefined) {
          expect(initialized[variable]).toEqual(definition.defaultValue);
          return;
        }
        /* The provider owns the default here: it must resolve the
         * initializer as unset so the registry default applies. */
        const { provider } = buildResolutionStack({});
        expect(
          await provider.resolve(definition.key, { appId: 'chat-ui' }),
          reason,
        ).toBeUndefined();
      },
    );

    it('lists only variables that still declare an initializer', () => {
      for (const variable of INITIALIZERS_RESOLVED_AS_UNSET.keys()) {
        expect(
          withInitializer.some((definition) => definition.envVar === variable),
        ).toBe(true);
      }
    });

    it('defaults every allowed-roles list to empty, meaning unrestricted', () => {
      const roleVariables = CONFIG_DEFINITIONS.flatMap((definition) =>
        definition.allowedRolesEnvVar ? [definition.allowedRolesEnvVar] : [],
      );
      expect(roleVariables.length).toBe(4);
      for (const variable of roleVariables) {
        expect(initialized[variable]).toEqual([]);
      }
    });
  });
});
