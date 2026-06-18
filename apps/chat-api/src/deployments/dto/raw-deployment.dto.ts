export interface RawDeploymentDto {
  id?: string;
  display_name?: string;
  object?: string;
  toolset?: string;
  icon_url?: string;
  updated_at?: string;
  reference?: string;
  description?: string;
  display_version?: string;
  interfaces?: string | string[];
  application_type_schema_id?: string;
  input_attachment_types?: string[];
  description_keywords?: string[];
}
