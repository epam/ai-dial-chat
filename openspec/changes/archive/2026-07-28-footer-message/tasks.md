## 1. NestJS — app-config: footer HTML message

- [x] 1.1 Add `FOOTER_HTML_MESSAGE` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts` (optional `@IsOptional() @IsString()`)
- [x] 1.2 Install `sanitize-html` and `@types/sanitize-html` in `apps/chat-api`
- [x] 1.3 Add `footerHtmlMessage: string` to the app-config response DTO (`ClientConfigDto` or equivalent in the app-config domain)
- [x] 1.4 In the app-config service, read `FOOTER_HTML_MESSAGE`, replace `%%VERSION%%` with `packageJSON.version`, sanitize with `sanitize-html` (allowlist: `a span strong u em br p`; inject `target="_blank" rel="noopener noreferrer"` on every `<a>`), and include in response
- [x] 1.5 Run `npm run openapi && npm run openapi:check` and rebuild `chat-api-client` after DTO change
- [x] 1.6 Write unit tests for the sanitization + token-substitution logic

## 2. NestJS — footer domain (BFF proxy endpoints)

- [x] 2.1 Add `AZURE_FUNCTIONS_API_HOST`, `REQUEST_API_KEY_CODE`, `REPORT_ISSUE_CODE` to `EnvironmentVariables` (optional; log a startup warning when absent)
- [x] 2.2 Create `apps/chat-api/src/footer/` domain folder with `footer.module.ts`, `footer.controller.ts`, `footer.service.ts`, and `dto/` subfolder
- [x] 2.3 Create `RequestApiKeyDto` with `@IsString() @IsNotEmpty()` on all fields and `@IsEmail()` on `project_lead`; add `@ApiProperty` on each
- [x] 2.4 Create `ReportIssueDto` with `@IsString() @IsNotEmpty()` on `title` and `description`
- [x] 2.5 Implement `footer.service.ts`: two methods that proxy to Azure Functions using `ConfigService`; throw `ServiceUnavailableException` when env vars absent; throw `BadGatewayException` on upstream failure; log errors at `error` level (no request body in logs)
- [x] 2.6 Implement `footer.controller.ts`: `POST /api/v1/footer/request-api-key` and `POST /api/v1/footer/report-issue`; session auth required (401 when unauthenticated); merge `requester_email` / `email` from `req.user` server-side; `@ApiOperation`, `@ApiResponse` for 200/401/503/502
- [x] 2.7 Register `FooterModule` in `app.module.ts`
- [x] 2.8 Run `npm run openapi && npm run openapi:check`
- [x] 2.9 Write unit tests for `footer.service.ts` covering happy path, missing env vars, and upstream failure

## 3. Frontend — server-api + AppConfig wiring

- [x] 3.1 Add `footerHtmlMessage: string` to the `ClientConfig` type in `apps/chat/src/server-api/` (or update the generated type after openapi regen)
- [x] 3.2 Create `apps/chat/src/server-api/footer.api.ts` with `requestApiKey(body)` and `reportIssue(body)` using `base.ts` `post()` helper and `ApiEndpoints` constants

## 4. Frontend — FooterMessage component

- [x] 4.1 Install `dompurify` and `@types/dompurify` in `apps/chat`
- [x] 4.2 Create `apps/chat/src/components/FooterMessage/FooterMessage.tsx`: reads `useAppConfig().config.footerHtmlMessage`, guards with `useFeatureFlag('footer')`, applies DOMPurify (browser-only), renders via `dangerouslySetInnerHTML`, delegates `data-dial-action` clicks via `onDialAction` callback prop
- [x] 4.3 Add i18n keys to `apps/chat/src/i18n/locales/en.json` and matching enum members in `translation-keys.ts` (aria-label for footer container)
- [x] 4.4 Place `FooterMessage` (wrapped in `FooterContainer`) in the desktop chat input footer area, guarded by the `desktop` screen breakpoint
- [x] 4.5 Place `FooterMessage` (wrapped in `FooterContainer`) in the mobile user panel, guarded by the `mobile` breakpoint
- [x] 4.6 Write component tests: renders null when flag off, renders null when message empty, renders sanitized HTML, fires `onDialAction` on `data-dial-action` click, does not fire on plain link click

## 5. Frontend — RequestApiKeyDialog

- [x] 5.1 Create `apps/chat/src/components/FooterDialogs/RequestApiKeyDialog.tsx` using `DialFormPopup` shell; accept `isOpen` and `onClose` props
- [x] 5.2 Add all 11 fields as controlled inputs (`Input`, `Textarea`, checkboxes from `@epam/ai-dial-kit`); track `fieldErrors: Record<string, string>`; clear field error on `onChange`; validate on submit before calling the hook
- [x] 5.3 Create `apps/chat/src/hooks/useRequestApiKey/useRequestApiKey.ts`: calls `footer.api.ts`, shows loading/success/error via `useNotification()`
- [x] 5.4 Add all `footer.requestApiKey.*` i18n keys to `en.json` and `translation-keys.ts`
- [x] 5.5 Write component tests: per-field error on invalid submit, successful submit calls hook and closes dialog, email validation error

## 6. Frontend — ReportIssueDialog

- [x] 6.1 Create `apps/chat/src/components/FooterDialogs/ReportIssueDialog.tsx` using `DialFormPopup` shell; accept `isOpen` and `onClose` props
- [x] 6.2 Add `title` and `description` as controlled inputs with per-field error state
- [x] 6.3 Create `apps/chat/src/hooks/useReportIssue/useReportIssue.ts`: calls `footer.api.ts`, shows loading/success/error via `useNotification()`
- [x] 6.4 Add all `footer.reportIssue.*` i18n keys to `en.json` and `translation-keys.ts`
- [x] 6.5 Write component tests: validation failure stays open, successful submit calls hook and closes

## 7. Documentation

- [x] 7.1 Add `FOOTER_HTML_MESSAGE` to the **Optional** env var table in `apps/chat-api/README.md` (column: default `—`, description: operator-authored HTML shown in the footer; supports `%%VERSION%%` token; sanitized server-side)
- [x] 7.2 Add `AZURE_FUNCTIONS_API_HOST`, `REQUEST_API_KEY_CODE`, `REPORT_ISSUE_CODE` to the **Optional** env var table in `apps/chat-api/README.md` (note: all three required together to enable the footer dialog BFF routes; missing vars return 503 on submit)
- [x] 7.3 Add `FOOTER_HTML_MESSAGE` entry to `apps/chat-api/.env.template` after the `ANNOUNCEMENT_HTML_MESSAGE` block, following the same commented-out example style
- [x] 7.4 Add `AZURE_FUNCTIONS_API_HOST`, `REQUEST_API_KEY_CODE`, `REPORT_ISSUE_CODE` entries to `apps/chat-api/.env.template` as a grouped "Footer Dialogs" comment block
## 8. Frontend — FooterContainer (wires dialogs to footer)

- [x] 8.1 Create `apps/chat/src/components/FooterDialogs/FooterContainer.tsx`: owns `isRequestApiKeyOpen` and `isReportIssueOpen` state; renders `FooterMessage` with `onDialAction` handler; renders `RequestApiKeyDialog` (when `useFeatureFlag('request-api-key')`) and `ReportIssueDialog` (when `useFeatureFlag('report-an-issue')`) with `isOpen`/`onClose` props
- [x] 8.2 Replace the bare `FooterMessage` usage in the desktop and mobile placements with `FooterContainer`
- [x] 8.3 Write integration test: clicking `data-dial-action="requestApiKey"` opens `RequestApiKeyDialog`; clicking `data-dial-action="reportIssue"` opens `ReportIssueDialog`; disabled flag prevents dialog from opening
