export interface UserProfile {
  sub: string;
  providerId: string;
  claims: Record<string, unknown>;
}

export interface ProviderInfo {
  id: string;
  label: string;
}
