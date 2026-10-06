# Server diagnostics

The application emits Pino JSON records marked `diagnostic_version: 1`.
[diagnostics.schema.json](../../app/diagnostics.schema.json) pins the version,
events, categories, methods, route templates and MCP tool names. The strict
[Zod boundary](../../app/diagnostics.ts) rejects other fields. Pino adds numeric
UTC epoch-millisecond `time` and `level`; those envelope fields are removed by
the collector before validation.

## Correlation and outcomes

Root server middleware generates a fresh UUID for every routed HTTP request,
ignores caller request IDs and returns `X-Request-Id`. AsyncLocalStorage carries
that ID into server errors and MCP outcomes. `request.complete` reports HTTP
status and elapsed time until the response is created; it does not measure the
full streamed body delivery. Static assets do not pass through root middleware.

`mcp.complete` observes the SDK transport's reply after sending it, including
SDK input rejection and HTTP 200 replies containing `isError`. A batch shares
one HTTP request ID; each tool outcome has a distinct event ID. The observer
keeps at most 100 pending tool calls per request. Excess concurrent calls emit
one `server.error` with `rate_limited` category to flag incomplete diagnostics;
they are still handled normally by the SDK. Durations are capped at one hour.

Expected domain errors preserve `validation`, `not_found` and `conflict`.
Recognized database/connection errors are `dependency` or `timeout`.
Unstructured SDK errors are `unexpected`; the app does not inspect free-text
messages to guess a category. Related server errors can supply a more specific
category under the same request ID. Background errors get independent UUIDs.

## Privacy

Existing Pino calls discard arbitrary objects and messages before serialization.
Only approved categories survive exception handling. Server entry error handling
uses the same projection. No request/response body, tool input/result, SQL,
parameters, email, credentials, health values, concrete entity path, raw stack
or error message is recorded. Unknown routes have no `route_id`. Morgan's tiny
access log is suppressed by the existing preload to avoid duplicating raw paths.
This does not enable browser error collection or external alerts.

## Release and operator gate

`GIT_SHA` must be a verified lowercase 40-character hexadecimal source SHA for marked diagnostics.
An absent/invalid value emits a fixed `release_missing` startup warning and
suppresses marked events; it never labels unknown code as a verified release.
Production activation requires all of these checks:

1. Pin the reviewed app source, successful CI, image digest and schema JSON hash.
2. Verify runtime `/healthz.sha` matches the candidate's 40-character hexadecimal source identity.
3. Request `/healthz` and verify a marked `request.complete` with that same
   release and its returned `X-Request-Id` before accepting the collector.
4. Reconcile exact route/tool/schema allowlists with the operator collector.
5. Prove synthetic HTTP 200 tool-error correlation and secret-canary exclusion.

Martin owns collector, retention and scoped read transport. The approved
first slice uses an allowlisted Fitness Docker source and a sanitized SQLite
store with seven-day expiry and physical byte caps; raw logs never enter it.
Read access is a separate forced SSH command, without shell, forwarding,
Docker socket, app environment or database access. Queries have a 24-hour maximum
window, 100 events, 256 KiB complete output and a 3-second process deadline. Freshness,
source transitions, gaps and truncation must be explicit. Those host controls
require independent tests and review before activation; app tests alone do not
prove retention or reader isolation.

Collection and the read identity can be disabled separately. Retention continues
for any preserved diagnostic store. Save host configuration separately and keep
recovery copies free of diagnostic data. This slice does not delete old raw
logs, migrate application data, rotate authentication secrets or change access
admission.
