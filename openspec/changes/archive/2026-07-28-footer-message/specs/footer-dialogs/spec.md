## ADDED Requirements

### Requirement: Footer container opens dialogs via `data-dial-action` attribute

A parent container component (`FooterDialogManager`) SHALL listen for `onDialAction` callbacks from `FooterMessage` and open the corresponding dialog. Supported action values: `"requestApiKey"`, `"reportIssue"`. Each dialog is only opened when its corresponding feature flag is enabled. Unknown action values SHALL be ignored.

- **Feature flags**: `request-api-key` and `report-an-issue` — checked via `useFeatureFlag('request-api-key')` / `useFeatureFlag('report-an-issue')` from `AppConfigContext`; independent of each other and of `footer`
- **State**: `isRequestApiKeyOpen` and `isReportIssueOpen` are local `useState` booleans in `FooterContainer`; dialogs are prop-driven (`isOpen`, `onClose`) following the existing modal pattern
- **RTL impact**: none at this layer

#### Scenario: requestApiKey action fired with flag enabled

- **WHEN** `onDialAction("requestApiKey")` is called and `request-api-key` is in `ENABLED_FEATURES`
- **THEN** the Request API Key dialog opens

#### Scenario: reportIssue action fired with flag disabled

- **WHEN** `onDialAction("reportIssue")` is called and `report-an-issue` is NOT in `ENABLED_FEATURES`
- **THEN** no dialog opens

#### Scenario: Unknown action ignored

- **WHEN** `onDialAction("unknownAction")` is called
- **THEN** no dialog opens and no error is thrown

---

### Requirement: Request API Key dialog collects and submits a validated form

The `RequestApiKeyDialog` component SHALL render a modal dialog using UI kit components with the following controlled fields. All fields are required. Per-field inline error messages SHALL appear below each invalid field on submit attempt. Errors SHALL clear for a field when its value changes.

**Fields and body keys sent to the API:**

| Label | Type | Body key |
|---|---|---|
| Project name | text input | `project_id` |
| Stream Name | text input | `project_stream` |
| Project Tech Lead (email) | email input | `project_lead` |
| Business justification | textarea | `business_reason` |
| End date of the project | date input (min = today) | `project_end` (sent as `DD/MM/YYYY`) |
| Access scenario description | textarea | `access_scenario` |
| Cost and workload description | textarea | `workload_pattern` |
| Azure Cognitive Service T&C | checkbox | client-only gate |
| EPAM company policies | checkbox | client-only gate |
| Not for client project production | checkbox | client-only gate |
| Local law regulations | checkbox | client-only gate |

- **i18n keys**:
  - `footer.requestApiKey.title` → "Request API Key"
  - `footer.requestApiKey.projectName` → "Project name"
  - `footer.requestApiKey.streamName` → "Stream Name"
  - `footer.requestApiKey.projectLead` → "Project Tech Lead (email)"
  - `footer.requestApiKey.businessJustification` → "Business justification"
  - `footer.requestApiKey.endDate` → "End date of the project"
  - `footer.requestApiKey.accessScenario` → "Access scenario description"
  - `footer.requestApiKey.workloadPattern` → "Cost and workload description"
  - `footer.requestApiKey.termsAzure` → "I agree to Azure Cognitive Service T&C"
  - `footer.requestApiKey.termsEpam` → "I comply with EPAM company policies"
  - `footer.requestApiKey.termsNotClient` → "This is not for client project production"
  - `footer.requestApiKey.termsLocalLaw` → "I comply with local law regulations"
  - `footer.requestApiKey.submit` → "Request"
  - `footer.requestApiKey.fieldRequired` → "This field is required"
  - `footer.requestApiKey.invalidEmail` → "Enter a valid email address"
  - `footer.requestApiKey.loading` → "Requesting API key in progress..."
  - `footer.requestApiKey.success` → "API Key requested successfully"
  - `footer.requestApiKey.error` → "Failed to request API key. Please try again."
- **RTL impact**: dialog layout uses logical Tailwind classes (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`)
- **Dialog shell**: `DialFormPopup` from `@epam/ai-dial-ui-kit` — handles focus trap and return focus internally
- **Toasts**: `useNotification()` from `NotificationContext` with `NotificationVariant.Loading` on submit, `NotificationVariant.Success` on 200, `NotificationVariant.Error` on failure
- **a11y**: checkboxes have `aria-required`; error messages linked via `aria-describedby`; submit button has `aria-busy` while loading; `role="status" aria-live="polite"` region for screen-reader feedback

#### Scenario: Successful submission

- **WHEN** all fields are valid and the user submits
- **THEN** the dialog closes, a loading toast is shown via `showNotification({ variant: NotificationVariant.Loading, ... })`, `POST /api/v1/footer/request-api-key` is called, and on 200 a success toast is shown

#### Scenario: Validation failure on submit

- **WHEN** user submits with one or more empty required fields
- **THEN** the dialog stays open and per-field error messages appear below each invalid field

#### Scenario: Email field validation

- **WHEN** the Project Tech Lead field contains a non-email string and user submits
- **THEN** an inline error "Enter a valid email address" appears below that field

#### Scenario: API error

- **WHEN** `POST /api/v1/footer/request-api-key` returns a non-200 response
- **THEN** an error toast is shown and the dialog stays closed (optimistic close on submit)

#### Scenario: Focus management

- **WHEN** the dialog opens
- **THEN** focus moves to the first focusable element inside the dialog

- **WHEN** the dialog closes
- **THEN** focus returns to the element that triggered the dialog open

---

### Requirement: Report an Issue dialog collects and submits a validated form

The `ReportIssueDialog` component SHALL render a modal dialog using UI kit components with two controlled fields. Both fields are required. Per-field inline error messages appear on submit failure and clear on change.

**Fields and body keys:**

| Label | Type | Body key |
|---|---|---|
| Title | text input | `title` |
| Description | textarea | `description` |

- **i18n keys**:
  - `footer.reportIssue.title` → "Report an Issue"
  - `footer.reportIssue.issueTitle` → "Title"
  - `footer.reportIssue.description` → "Description"
  - `footer.reportIssue.submit` → "Report"
  - `footer.reportIssue.fieldRequired` → "This field is required"
  - `footer.reportIssue.loading` → "Reporting issue in progress..."
  - `footer.reportIssue.success` → "Issue reported successfully"
  - `footer.reportIssue.error` → "Failed to report issue. Please try again."
- **RTL impact**: same as Request API Key dialog — logical Tailwind classes
- **a11y**: same pattern as Request API Key dialog

#### Scenario: Successful submission

- **WHEN** both fields are filled and user submits
- **THEN** the dialog closes, a loading toast is shown, `POST /api/v1/footer/report-issue` is called, and on 200 a success toast is shown

#### Scenario: Validation failure

- **WHEN** user submits with Title or Description empty
- **THEN** the dialog stays open with per-field error messages shown

---

### Requirement: `POST /api/v1/footer/request-api-key` BFF endpoint

The NestJS endpoint SHALL:
1. Require an authenticated session (return 401 if not authenticated)
2. Accept the request body matching `RequestApiKeyDto`
3. Read `AZURE_FUNCTIONS_API_HOST` and `REQUEST_API_KEY_CODE` from `ConfigService`; return 503 if either is absent
4. POST to `${AZURE_FUNCTIONS_API_HOST}/api/request?code=${REQUEST_API_KEY_CODE}` merging `requester_email` from the authenticated session
5. Return 200 `{}` on success; 502 on upstream failure

**Request body (`RequestApiKeyDto`):**

```json
{
  "project_id": "My Project",
  "project_stream": "Stream A",
  "project_lead": "lead@example.com",
  "business_reason": "We need access for...",
  "project_end": "31/12/2025",
  "access_scenario": "Usage description...",
  "workload_pattern": "Cost estimate..."
}
```

**Response (200):** `{}`

**Error responses:**
- `401` — unauthenticated
- `503` — Azure Functions env vars not configured
- `502` — upstream Azure Functions call failed

- **Auth**: session required; `requester_email` injected server-side from session, never trusted from client
- **Rate limiting**: inherits global NestJS throttler default
- **Observability**: log upstream errors at `error` level with status code; do not log request body

#### Scenario: Successful proxy

- **WHEN** an authenticated user POSTs valid body and Azure Functions returns 200
- **THEN** the endpoint returns 200 `{}`

#### Scenario: Missing env vars

- **WHEN** `AZURE_FUNCTIONS_API_HOST` or `REQUEST_API_KEY_CODE` is not set
- **THEN** the endpoint returns 503 with a descriptive error message

#### Scenario: Unauthenticated request

- **WHEN** the request has no valid session
- **THEN** the endpoint returns 401

---

### Requirement: `POST /api/v1/footer/report-issue` BFF endpoint

The NestJS endpoint SHALL:
1. Require an authenticated session (return 401 if not authenticated)
2. Accept the request body matching `ReportIssueDto`
3. Read `AZURE_FUNCTIONS_API_HOST` and `REPORT_ISSUE_CODE` from `ConfigService`; return 503 if absent
4. POST to `${AZURE_FUNCTIONS_API_HOST}/api/issue?code=${REPORT_ISSUE_CODE}` merging `email` from the authenticated session
5. Return 200 `{}` on success; 502 on upstream failure

**Request body (`ReportIssueDto`):**

```json
{
  "title": "Something is broken",
  "description": "Detailed description..."
}
```

**Response (200):** `{}`

**Error responses:**
- `401` — unauthenticated
- `503` — Azure Functions env vars not configured
- `502` — upstream Azure Functions call failed

- **Auth**: session required; `email` injected server-side, never trusted from client
- **Rate limiting**: inherits global NestJS throttler default
- **Observability**: log upstream errors at `error` level; do not log request body

#### Scenario: Successful proxy

- **WHEN** an authenticated user POSTs valid body and Azure Functions returns 200
- **THEN** the endpoint returns 200 `{}`

#### Scenario: Missing env vars

- **WHEN** `AZURE_FUNCTIONS_API_HOST` or `REPORT_ISSUE_CODE` is not set
- **THEN** the endpoint returns 503

#### Scenario: Unauthenticated request

- **WHEN** the request has no valid session
- **THEN** the endpoint returns 401

---

### Requirement: Environment variables for footer dialogs

`apps/chat-api/src/config/environment.config.ts` SHALL declare the following optional variables with a startup warning when either dialog feature is enabled but the variables are absent:

| Variable | Purpose |
|---|---|
| `AZURE_FUNCTIONS_API_HOST` | Base URL for the Azure Functions backend |
| `REQUEST_API_KEY_CODE` | Auth code for the `/api/request` Azure Function |
| `REPORT_ISSUE_CODE` | Auth code for the `/api/issue` Azure Function |

#### Scenario: Missing host at startup

- **WHEN** `AZURE_FUNCTIONS_API_HOST` is not set
- **THEN** the app starts successfully but logs a warning that footer dialog submissions will return 503
