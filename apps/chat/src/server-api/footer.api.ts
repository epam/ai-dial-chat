import { ApiEndpoints, post } from './base';

export interface RequestApiKeyPayload {
  project_id: string;
  project_stream: string;
  project_lead: string;
  business_reason: string;
  project_end: string;
  access_scenario: string;
  workload_pattern: string;
}

export interface ReportIssuePayload {
  title: string;
  description: string;
}

export const submitRequestApiKey = (
  payload: RequestApiKeyPayload,
): Promise<void> => post<void>(ApiEndpoints.FOOTER_REQUEST_API_KEY, payload);

export const submitReportIssue = (payload: ReportIssuePayload): Promise<void> =>
  post<void>(ApiEndpoints.FOOTER_REPORT_ISSUE, payload);
