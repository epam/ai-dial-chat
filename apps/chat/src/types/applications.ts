import { DialAIEntityFeatures, DialAIEntityModel } from './models';
import { QuickApp2Config, QuickAppConfig } from './quick-apps';

import { ShareEntity } from '@epam/ai-dial-shared';

export enum ApplicationStatus {
  DEPLOYED = 'DEPLOYED',
  DEPLOYING = 'DEPLOYING',
  UNDEPLOYED = 'UNDEPLOYED',
  UNDEPLOYING = 'UNDEPLOYING',
  FAILED = 'FAILED',
  REDEPLOYED = 'REDEPLOYED',
  REDEPLOYING = 'REDEPLOYING',
}

export enum SimpleApplicationStatus {
  DEPLOY = 'deploy',
  UNDEPLOY = 'undeploy',
  UPDATING = 'updating',
  REDEPLOY = 'redeploy',
}

export interface ApiApplicationFunctionType {
  error?: string;
  status: ApplicationStatus;
  runtime: string;
  source_folder: string;
  mapping: Record<string, string>;
  env?: Record<string, string>;
}

export interface ApiApplicationResponseBase {
  display_name: string | Record<string, string>;
  display_version: string;
  icon_url: string;
  description: string | Record<string, string>;
  features: DialAIEntityFeatures;
  input_attachment_types: string[];
  max_input_attachments: number;
  defaults: Record<string, unknown>;
  reference: string;
  forward_auth_token: boolean;
  description_keywords?: string[];
  endpoint: string;
  function?: ApiApplicationFunctionType;
  application_type_schema_id?: string;
  application_properties?:
    | QuickAppConfig
    | QuickApp2Config
    | Record<string, unknown>;
  author?: string;
  created_at?: number;
  updated_at?: number;
}

export interface ApiApplicationResponsePublication
  extends ApiApplicationResponseBase {
  application: string;
}

export interface ApiApplicationResponseDefault
  extends ApiApplicationResponseBase {
  name: string;
}

export type ApiApplicationResponse =
  | ApiApplicationResponsePublication
  | ApiApplicationResponseDefault;

export interface ApiApplicationModelBase {
  display_name: string | Record<string, string>;
  display_version: string;
  icon_url: string;
  description?: string | Record<string, string>;
  features?: DialAIEntityFeatures;
  input_attachment_types?: string[];
  max_input_attachments?: number;
  defaults?: Record<string, unknown>;
  url?: string;
  reference?: string;
  description_keywords?: string[];
  applicationTypeSchemaId?: string;
  applicationProperties?: QuickAppConfig | Record<string, unknown>;
}

export interface ApiTypeSchemaApplication extends ApiApplicationModelBase {
  application_type_schema_id: string;
  application_properties: QuickAppConfig | Record<string, unknown> | null;
}

export interface ApiApplicationModelRegular extends ApiApplicationModelBase {
  endpoint: string;
  function?: never;
}

export interface ApiApplicationModelSchema extends ApiApplicationModelBase {
  endpoint?: never;
  applicationTypeSchemaId: string;
}

export interface ApiApplicationModelFunction extends ApiApplicationModelBase {
  endpoint?: never;
  function: Omit<ApiApplicationFunctionType, 'status'>;
}

export type ApiApplicationModel =
  | ApiApplicationModelRegular
  | ApiTypeSchemaApplication
  | ApiApplicationModelFunction
  | ApiApplicationModelSchema;

export interface ApplicationInfo extends Omit<ShareEntity, 'name'> {
  name: string | Record<string, string>;
  version: string;
}

export type ApplicationPropertiesType =
  | QuickAppConfig
  | QuickApp2Config
  | (Record<string, unknown> & ExternalAppConfig)
  | null;

export interface CustomApplicationModel
  extends DialAIEntityModel,
    ApplicationInfo {
  completionUrl?: string;
  applicationTypeSchemaId?: string;
  function?: {
    status?: ApplicationStatus;
    runtime?: string;
    sourceFolder: string;
    mapping: Record<string, string>;
    env?: Record<string, string>;
  };
  version: string;
  applicationProperties?: ApplicationPropertiesType;
}

export interface ExternalAppConfig {
  external_url?: string;
}

export interface ExternalAppModel extends DialAIEntityModel, ApplicationInfo {
  applicationTypeSchemaId?: string;
  version: string;
  applicationProperties?: ApplicationPropertiesType;
}

export interface ApplicationLogsType {
  logs: { content: string; instance: string }[];
}

export enum ApplicationActionType {
  ADD = 'ADD',
  EDIT = 'EDIT',
}

export enum ApplicationType {
  CUSTOM_APP = 'custom_app',
  CODE_APP = 'code_app',
}

export enum Toolsets {
  WebApiToolset = 'webApiToolset',
  McpToolset = 'mcpToolset',
}

export type ApplicationContextMenuDisabledActions = Partial<{
  copyLink: boolean;
  deploy: boolean;
  edit: boolean;
  share: boolean;
  unshare: boolean;
  publish: boolean;
  unpublish: boolean;
  logs: boolean;
  delete: boolean;
}>;
