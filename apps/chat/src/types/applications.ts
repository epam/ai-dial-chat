import { DialAIEntityFeatures, DialAIEntityModel } from './models';

import { Entity } from '@epam/ai-dial-shared';

export enum ApplicationStatus {
  STARTED = 'STARTED',
  STOPPED = 'STOPPED',
  CREATED = 'CREATED',
  FAILED = 'FAILED',
}

export interface ApiApplicationFunctionType {
  error?: string;
  status?: ApplicationStatus;
  runtime: string;
  source_folder: string;
  mapping: Record<string, string>;
  env?: Record<string, string>;
}

export interface ApiApplicationResponseBase {
  display_name: string;
  display_version: string;
  icon_url: string;
  description: string;
  features: DialAIEntityFeatures;
  input_attachment_types: string[];
  max_input_attachments: number;
  defaults: Record<string, unknown>;
  reference: string;
  forward_auth_token: boolean;
  description_keywords?: string[];
}

export interface ApiApplicationResponseRegular
  extends ApiApplicationResponseBase {
  endpoint: string;
  function?: never;
}

export interface ApiApplicationResponseFunction
  extends ApiApplicationResponseBase {
  endpoint?: never;
  function: ApiApplicationFunctionType;
}

export type ApiApplicationResponsePublication = { application: string } & (
  | ApiApplicationResponseRegular
  | ApiApplicationResponseFunction
);

export type ApiApplicationResponseDefault = { name: string } & (
  | ApiApplicationResponseRegular
  | ApiApplicationResponseFunction
);

export type ApiApplicationResponse =
  | ApiApplicationResponsePublication
  | ApiApplicationResponseDefault;

export interface ApiApplicationModelBase {
  display_name: string;
  display_version: string;
  icon_url: string;
  description?: string;
  features?: DialAIEntityFeatures;
  input_attachment_types?: string[];
  max_input_attachments?: number;
  defaults?: Record<string, unknown>;
  url?: string;
  reference?: string;
  description_keywords?: string[];
}

export interface ApiApplicationModelRegular extends ApiApplicationModelBase {
  endpoint: string;
  function?: never;
}

export interface ApiApplicationModelFunction extends ApiApplicationModelBase {
  endpoint?: never;
  function: ApiApplicationFunctionType;
}

export type ApiApplicationModel =
  | ApiApplicationModelRegular
  | ApiApplicationModelFunction;

export interface ApplicationInfo extends Entity {
  version: string;
}
export interface CustomApplicationModel
  extends DialAIEntityModel,
    ApplicationInfo {
  completionUrl: string;
  function?: {
    status?: ApplicationStatus;
    runtime?: string;
    sourceFolder: string;
    mapping: Record<string, string>;
    env?: Record<string, string>;
  };
  version: string;
}

export enum ApplicationActionType {
  ADD = 'ADD',
  EDIT = 'EDIT',
}

export enum ApplicationType {
  CUSTOM_APP,
  QUICK_APP,
  EXECUTABLE,
}
