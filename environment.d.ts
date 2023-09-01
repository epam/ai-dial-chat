export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY: string;
      OPENAI_API_HOST: string;
      OPENAI_API_VERSION?: string;

      TRACES_URL?: string;
    }
  }
}
