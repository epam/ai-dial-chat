export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_VIEWER_HOST: string;
      NEXT_PUBLIC_APP_NAME: string;
    }
  }
}
