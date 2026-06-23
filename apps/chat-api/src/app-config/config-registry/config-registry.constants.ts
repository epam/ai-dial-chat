import type { ConfigDefinition } from '../app-config.types';

export const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  {
    key: 'asr.modelId',
    type: 'config',
    valueType: 'string',
    visibility: 'client',
    defaultValue: null,
    critical: false,
    description:
      'Deployment ID of the ASR model used for transcription. Null when ASR_MODEL is not configured.',
    owner: 'chat-team',
    envVar: 'ASR_MODEL',
  },
  {
    key: 'asr.transcribeSizeLimitBytes',
    type: 'config',
    valueType: 'number',
    visibility: 'client',
    defaultValue: 5 * 1024 * 1024,
    critical: false,
    description:
      'Maximum audio file size in bytes accepted by the transcription endpoint.',
    owner: 'chat-team',
    envVar: 'TRANSCRIBE_SIZE_LIMIT_BYTES',
  },
  {
    key: 'features.asrEnabled',
    type: 'feature',
    valueType: 'boolean',
    visibility: 'client',
    defaultValue: false,
    critical: false,
    description:
      'Whether ASR (Automatic Speech Recognition) transcription is enabled. Derived from ASR_MODEL presence. Set ASR_ENABLED_ROLES to restrict to specific roles.',
    owner: 'chat-team',
    allowedRolesEnvVar: 'ASR_ENABLED_ROLES',
  },
];
