import { ApiTypeSchemaApplication } from '@/chat/types/applications';
import { QuickAppConfig } from '@/chat/types/quick-apps';
import { ExpectedConstants } from '@/src/testData';
import { ApplicationBuilderBase } from '@/src/testData/applications/applicationBuilderBase';
import { GeneratorUtil } from '@/src/utils';
import { webcrypto } from 'node:crypto';

export class ExternalApplicationBuilder extends ApplicationBuilderBase<ApiTypeSchemaApplication> {
  withApplicationTypeSchemaId(schemaId: string): this {
    this.application.application_type_schema_id = schemaId;
    return this;
  }

  withApplicationProperties(
    properties: QuickAppConfig | Record<string, unknown> | null,
  ): this {
    this.application.application_properties = properties;
    return this;
  }

  withExternalUrl(externalUrl: string): this {
    if (
      !this.application.application_properties ||
      typeof this.application.application_properties !== 'object'
    ) {
      this.application.application_properties = {
        external_url: externalUrl,
        document_relative_url: [],
      };
    } else {
      this.application.application_properties = {
        ...this.application.application_properties,
        external_url: externalUrl,
        document_relative_url:
          this.application.application_properties.document_relative_url || [],
      };
    }
    return this;
  }

  withDocumentRelativeUrl(urls: string[]): this {
    if (
      !this.application.application_properties ||
      typeof this.application.application_properties !== 'object'
    ) {
      this.application.application_properties = {
        external_url: '',
        document_relative_url: urls,
      };
    } else {
      this.application.application_properties = {
        ...this.application.application_properties,
        document_relative_url: urls,
      };
    }
    return this;
  }

  protected reset(): ApiTypeSchemaApplication {
    this.application = {
      display_name: GeneratorUtil.randomString(7),
      display_version: ExpectedConstants.defaultAppVersion,
      application_type_schema_id: '',
      application_properties: null,
      icon_url: '',
      description: '',
      input_attachment_types: [],
      description_keywords: [],
      reference: webcrypto.randomUUID(),
    };
    return this.application;
  }
}
