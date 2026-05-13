export interface SessionPayload {
  v: 1;
  sid: string;
  providerId: string;
  sub: string;
  at: string;
  rt: string;
  at_exp: number;
  rt_exp: number;
  iat: number;
  csrf: string;
  claims: Record<string, unknown>;
}

export interface SessionUser {
  sid: string;
  sub: string;
  providerId: string;
  claims: Record<string, unknown>;
  at: string;
}
