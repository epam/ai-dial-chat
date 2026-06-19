export interface DialModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  [key: string]: unknown;
}

export interface DialModelListResponse {
  data: DialModel[];
}
