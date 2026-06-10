/** DIAL-specific options for a single starter button entry. */
export interface StarterWidgetOptions {
  /** Text to populate in the input field when the starter is selected. */
  populateText: string | null;
  /** When true, automatically submits the message after populating the input. */
  submit: boolean;
  /** Optional confirmation message shown before submission. */
  confirmationMessage: string | null;
}

/**
 * A single entry in the `starter` property's `oneOf` array.
 * Represents one quick-start conversation button.
 */
export interface StarterOption {
  /** Numeric index used as the schema `const` value. */
  const: number;
  /** Display label for the starter button. */
  title: string;
  /** DIAL widget options controlling input population and auto-submit behaviour. */
  'dial:widgetOptions': StarterWidgetOptions;
}

/**
 * A single property entry within a deployment's configuration JSON Schema.
 * Each key in `DeploymentConfigurationSchema.properties` maps to this shape.
 */
export interface DeploymentConfigurationSchemaProperty {
  /** Default value for this property. */
  default?: unknown;
  /** Human-readable description of this property. */
  description?: string;
  /** DIAL-specific widget hint (e.g. "buttons"). */
  'dial:widget'?: string;
  /** List of allowed value variants (JSON Schema oneOf). For the `starter` property these are {@link StarterOption} entries. */
  oneOf?: StarterOption[] | unknown[];
  /** Index signature for additional JSON Schema keywords. */
  [key: string]: unknown;
}

/**
 * JSON Schema object returned by the DIAL Core deployment configuration endpoint
 * (`GET /v1/deployments/{deployment_name}/configuration`).
 * Only present for deployments whose `features.configuration` flag is `true`.
 */
export interface DeploymentConfigurationSchema {
  /** JSON Schema type (typically "object"). */
  type?: string;
  /** Human-readable schema title. */
  title?: string;
  /** Whether additional properties are allowed, or a schema for them. */
  additionalProperties?: boolean | Record<string, unknown>;
  /** Named configuration properties supported by this deployment. */
  properties?: Record<string, DeploymentConfigurationSchemaProperty>;
  /**
   * When `true`, the application does not accept free-form text input.
   * Users interact only via form/action buttons defined in the schema.
   * Mapped from `dial:chatMessageInputDisabled` by the backend.
   */
  isChatMessageInputDisabled?: boolean;
  /** Index signature for additional JSON Schema keywords. */
  [key: string]: unknown;
}
