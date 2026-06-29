export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DIAL_API_KEY: string;
      DIAL_API_HOST: string;
      DIAL_CORE_EXTERNAL_URL?: string;

      QUICK_APPS_HOST?: string;
      QUICK_APPS_MODEL?: string;
      QUICK_APPS_SCHEMA_ID?: string;

      EXTERNAL_APPS_SCHEMA_ID?: string;

      DIAL_API_VERSION?: string;
      APP_BASE_PATH?: string;
      APP_BASE_ORIGIN?: string;
      ALLOWED_IFRAME_ORIGINS?: string;
      ALLOWED_IFRAME_SOURCES?: string;
      ALLOWED_SCRIPT_SOURCES?: string;
      ALLOWED_IMAGE_SOURCES?: string;
      IS_IFRAME?: string;
      ALLOW_OPEN_SIGNIN_PAGE_IN_IFRAME?: string;
      CUSTOM_VISUALIZERS?: string;
      APPLICATION_VISUALIZERS?: string;
      ALLOW_VISUALIZER_SEND_MESSAGES?: boolean;
      ALLOW_TOKEN_IN_SESSION?: boolean;
      ENABLED_FEATURES?: string;
      AVAILABLE_LOCALES?: string;
      PUBLICATION_FILTERS?: string;
      ADMIN_ROLE_NAMES?: string;
      DIAL_ROLES_FIELD?: string;
      CODE_APPS_ROLES?: string;
      NEXT_PUBLIC_APP_NAME?: string;
      NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT?: string;
      NEXT_PUBLIC_DEFAULT_TEMPERATURE?: string;
      NEXT_PUBLIC_RESOURCE_MAX_SEGMENT_BYTES?: string;
      DEFAULT_MODEL?: string;
      RECENT_MODELS_IDS?: string;
      E2E_HOST?: string;
      E2E_USERNAME?: string;
      E2E_PASSWORD?: string;
      TMS_URL?: string;
      ISSUE_URL?: string;
      THEMES_CONFIG_HOST?: string;
      THEME_DEFAULT_ID?: string;
      FOOTER_HTML_MESSAGE?: string;
      ANNOUNCEMENT_HTML_MESSAGE?: string;
      AZURE_FUNCTIONS_API_HOST?: string;
      REPORT_ISSUE_CODE?: string;
      REQUEST_API_KEY_CODE?: string;
      CODE_GENERATION_WARNING?: string;
      SHOW_TOKEN_SUB?: string;
      STORAGE_TYPE?: string;
      MAX_PROMPT_TOKENS_DEFAULT_PERCENT?: string;
      MAX_PROMPT_TOKENS_DEFAULT_VALUE?: string;
      TOPICS?: string;
      HIDDEN_ENTITY_TAG?: string;
      CODE_EDITOR_PYTHON_VERSIONS?: string;
      WIDGETS_SCHEMA_IDS?: string;
      NEXT_PUBLIC_STAGE_CONTENT_LIMIT?: string;

      ASR_MODEL?: string;

      ATTACHMENT_TYPES_EXPANDED?: string;
      ATTACHMENT_TYPES_BORDERLESS?: string;
      ATTACHMENT_TYPES_WITHOUT_TITLE?: string;

      NEXTAUTH_URL?: string;
      NEXTAUTH_SECRET?: string;
      AUTH_FORCE_STRICT?: string;
      AUTH_ADDITIONAL_PARAMS?: string;
      AUTH_TEST_TOKEN?: string;
      AUTH_AUTH0_AUDIENCE?: string;
      AUTH_AUTH0_CLIENT_ID?: string;
      AUTH_AUTH0_HOST?: string;
      AUTH_AUTH0_NAME?: string;
      AUTH_AUTH0_SECRET?: string;
      AUTH_AUTH0_SCOPE?: string;
      AUTH_AZURE_AD_CLIENT_ID?: string;
      AUTH_AZURE_AD_NAME?: string;
      AUTH_AZURE_AD_SECRET?: string;
      AUTH_AZURE_AD_TENANT_ID?: string;
      AUTH_AZURE_AD_SCOPE?: string;
      AUTH_GITLAB_CLIENT_ID?: string;
      AUTH_GITLAB_HOST?: string;
      AUTH_GITLAB_NAME?: string;
      AUTH_GITLAB_SECRET?: string;
      AUTH_GITLAB_SCOPE?: string;
      AUTH_GOOGLE_CLIENT_ID?: string;
      AUTH_GOOGLE_NAME?: string;
      AUTH_GOOGLE_SECRET?: string;
      AUTH_GOOGLE_SCOPE?: string;
      AUTH_KEYCLOAK_CLIENT_ID?: string;
      AUTH_KEYCLOAK_HOST?: string;
      AUTH_KEYCLOAK_NAME?: string;
      AUTH_KEYCLOAK_SECRET?: string;
      AUTH_KEYCLOAK_SCOPE?: string;
      AUTH_PING_ID_CLIENT_ID?: string;
      AUTH_PING_ID_HOST?: string;
      AUTH_PING_ID_NAME?: string;
      AUTH_PING_ID_SECRET?: string;
      AUTH_PING_ID_SCOPE?: string;
      AUTH_COGNITO_CLIENT_ID?: string;
      AUTH_COGNITO_SECRET?: string;
      AUTH_COGNITO_HOST?: string;
      AUTH_COGNITO_NAME?: string;
      AUTH_COGNITO_SCOPE?: string;
      AUTH_OKTA_CLIENT_ID?: string;
      AUTH_OKTA_CLIENT_SECRET?: string;
      AUTH_OKTA_ISSUER?: string;
      AUTH_OKTA_SCOPE?: string;
      AUTH_OKTA_NAME?: string;
    }
  }
}
