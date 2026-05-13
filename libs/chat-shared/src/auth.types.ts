export interface UserProfile {
  sub: string;
  providerId: string;
  claims: Record<string, unknown>;
}
