export interface RequestAPIKeyBody {
    project_id: string,
    project_stream: string,
    project_lead: string,
    project_end: string,
    business_reason: string,
    workload_pattern: string,
    access_scenario: string,
    requester_email: string,
}