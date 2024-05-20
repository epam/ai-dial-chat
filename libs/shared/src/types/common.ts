export interface DialLibRequest {
  type: string;
  requestId: string;
  payload?: unknown;
}

export type Styles = { [property in keyof CSSStyleDeclaration]?: string };
