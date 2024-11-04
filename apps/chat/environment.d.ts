export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DIAL_API_KEY: string;
      DIAL_API_HOST: string;

      DIAL_API_VERSION?: string;
      APP_BASE_PATH?: string;
      APP_BASE_ORIGIN?: string;
      ALLOWED_IFRAME_ORIGINS?: string;
      IS_IFRAME?: string;
      ALLOWED_IFRAME_SOURCES?: string;
      CUSTOM_VISUALIZERS?: string;
      ALLOW_VISUALIZER_SEND_MESSAGES?: boolean;
      ENABLED_FEATURES?: string;
      PUBLICATION_FILTERS?: string;
      ADMIN_ROLE_NAMES?: string;
      DIAL_ROLES_FIELD?: string;
      NEXT_PUBLIC_APP_NAME?: string;
      NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT?: string;
      NEXT_PUBLIC_DEFAULT_TEMPERATURE?: string;
      DEFAULT_MODEL?: string;
      NEXT_PUBLIC_DEFAULT_ASSISTANT_SUB_MODEL?: string;
      RECENT_MODELS_IDS?: string;
      RECENT_ADDONS_IDS?: string;
      E2E_HOST?: string;
      E2E_USERNAME?: string;
      E2E_PASSWORD?: string;
      TMS_URL?: string;
      ISSUE_URL?: string;
      THEMES_CONFIG_HOST?: string;
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
      CODE_EDITOR_PYTHON_VERSIONS?: string;

      NEXTAUTH_URL?: string;
      NEXTAUTH_SECRET?: string;
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
    }
  }
}
