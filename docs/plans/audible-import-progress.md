# Audible import implementation progress

Branch: `feature/audible-import`.

This file is a chronological implementation log and includes approaches that were later changed. See [`audible-import-handoff.md`](./audible-import-handoff.md) for the authoritative current decisions, architecture, real-container findings, verification record, and remaining acceptance work.

## Completed

- Read the entire plan and inspected the server, client, shared models, Dockerfiles, and release workflow.
- Created the feature branch.
- Defined shared request and snapshot types in `projects/shared/src/AudibleImport.ts`.
- Shared TypeScript check passed.
- Confirmed the official Libation CLI commands.
- Docker/CI work corrected the branch publishing risk; pre-publish runtime smoke is in place.
- Frontend production build, lint, and four automated tests passed.
- Added API-level non-admin `/updateBook` authorization test; it passed.
- Bumped root release version to `1.6.0` so the existing release job creates an artifact on merge.
- Backend, frontend, shared models, Dockerfiles, CI checks and manual acceptance documentation are implemented.
- Integrated mocked Libation test verifies real M4B publication and `/books` availability while a second download runs.
- Final server suite: 11/11 passed; client suite: 4/4 passed. Repository lint and production build passed.
- Release artifact `npm ci --omit=dev --prefix bin` passed after allowing network access. Bundled `node-pty` loads and FFprobe executes.
- Docker Desktop became available. Linux arm64 and amd64 production release images built successfully. Both passed the Libation, FFprobe, non-root user, writable temporary configuration, and native PTY smoke check. The amd64 check ran under emulation.
- Verified the CLI accepts `scan`, JSON `export`, and targeted `liberate` arguments. Started the production app in the isolated image; `/` responded and unauthenticated `/audible/status` returned HTTP 401.
- Fixed the Docker smoke script to create a temporary `Settings.json`, which Libation requires even for `version` and `--help` commands.
- Re-ran the final 11 server and 4 client tests, repository lint, and production build after Docker verification; all passed.
- Restored `node:current-slim` in the Dockerfile, dynamically selected Debian's ICU/OpenSSL runtime packages, and resolved the latest Libation release and SHA256 digest at image build time.
- The daily container workflow now rebuilds when either the base image or Libation package changes. The native PTY install-script approval applies to future `node-pty` versions.
- Final `current-slim` arm64 and amd64 images built and passed runtime smoke checks. An intentionally mismatched Libation digest failed the build, confirming the digest affects the cache. The final arm64 app served `/` and returned HTTP 401 for unauthenticated `/audible/status`.
- Added two release metadata resolver tests; server 11/11, client 4/4, resolver 2/2, lint, TypeScript production build, and workflow YAML parse passed.
- A fresh production `npm ci --omit=dev --prefix bin` completed with the name-only `node-pty` install-script approval; its release image rebuilt successfully.
- The Dockerfile runs `apt-get upgrade` during builds. The daily workflow checks available upgrades inside the last published Books image and rebuilds only when upgrades exist or another existing trigger changes. The APT layer is refreshed on every candidate build.
- The APT check is tested with zero upgrades, two upgrades, and update/simulation failures. The exact container command returned zero upgrades on the current image. Final arm64 and amd64 images built with APT upgrade, passed the Libation/PTY smoke check, and showed zero pending upgrades. The arm64 app still served `/` and returned HTTP 401 for unauthenticated `/audible/status`.
- The publishing workflow also hashes relevant container sources so Docker-only changes publish on the next scheduled run without a manual dispatch; unchanged daily runs still skip publishing.
- Parsed every publishing workflow shell step with `bash -n` and exercised the actual build decision: unchanged image skipped, two APT upgrades triggered a build, and a changed container source digest triggered a build.
- Removed the separate container check workflow at the user's request. The publishing workflow still checks the candidate image before upload.
- Removed the completed-book `readOnly` override after clarifying that reading status is account-level. Non-admin users retain status controls while metadata editing stays admin-only.
- Converted standalone container and release checks from CommonJS to directly runnable TypeScript under Node 26, with no added package. Grouped server Audible code under `projects/server/src/audible`.
- ASIN is now read with book metadata into `Book.asin`; duplicate checks query the in-memory book tree. Missing ASIN reads return an empty string, MP3 files are excluded from Audible audio discovery, and the route declarations use named Fastify request interfaces and shared pre-handler options.
- After those changes: server tests 11/11, client tests 4/4, standalone TypeScript script tests 3/3, repository lint, script TypeScript check, and production build passed. A fresh `Dockerfile` image built successfully and its TypeScript runtime smoke check passed for Libation, FFprobe, non-root execution, temporary staging, and native PTY.
- Server Audible tests were grouped under `test/audible`; the client test remains in `projects/client/test`. The server suite also verifies empty ASIN reads for M4B and MP3 and confirms Audible file discovery excludes MP3. Tests 11/11 server and 4/4 client passed after the move; production build and lint passed.
- Rebuilt the final release image after the ASIN normalization fix. Its Libation/PTY smoke check passed. The running image served `/` with HTTP 200 and returned HTTP 401 for unauthenticated `/audible/status`.
- The Libation installer, release resolver, and runtime smoke script remain in `scripts`; script tests 3/3, script TypeScript check, root lint, workflow YAML parse, release-image build, and runtime smoke check passed.
- Review queue entries now contain `Book` directly; their ASIN is read from `book.asin`, removing the duplicate queue field.
- After removing the duplicate review ASIN, server tests 11/11, client tests 4/4, standalone script tests 3/3, full repository lint, script TypeScript check, and production build passed.
- The final rebuilt release image passed its Libation/FFprobe/PTY smoke check, served `/` with HTTP 200, and returned HTTP 401 for unauthenticated `/audible/status`.
- Moved `validateAdminRequest` and its Fastify pre-handler option into `Validation.ts` with the shared validation response helper. Server tests 11/11, server build, server lint, and `git diff --check` passed afterward.
- Restored the client, shared, and build scripts to their original directory layout at the user's request. Only the server Audible source and tests use an `audible` folder.
- After restoring that layout: server tests 11/11, client tests 4/4, script tests 3/3, full lint, production build, workflow YAML parse, Docker release-image build and runtime smoke check passed.
- Moved the client Audible requests and snapshot restoration into `LoggedInApiClass`, replaced string-based UI route calls with typed methods, and removed `AudibleApi.ts`. Client tests now cover all Audible routes and expired authentication; the client production build passed.
- Narrowed Audible JSON responses by checking both typed and message-only errors before restoring a snapshot, removing the return-path cast. Client TypeScript check, tests, and lint passed.
- Extended `callApi` to support GET, added typed Audible request and response messages, and moved the Audible client methods onto `callApi`. The HTTP routes now wrap snapshots and import errors in `AudibleImportResponse`; SSE still emits snapshot events.
- With the typed protocol: server tests 11/11, client tests 7/7, repository lint, production build, and `git diff --check` passed.
- Removed the Audible-only failure and snapshot helper methods from `LoggedInApiClass`; its Audible methods now directly return `callApi` results. The Audible component handles response data and import errors. Client tests 7/7, TypeScript check, and lint passed.
- Simplified the Audible import effect: the fetch abort signal now also marks cleanup, replacing the separate `live` flag; status refresh has one loading update and the cleanup stops polling, SSE, and pending requests.
- Removed the separate `loading` state. An undefined `SnapshotState` means the initial status is pending; a defined state with no snapshot means no import; and a populated snapshot means an import exists. `busy` and `connected` remain independent action and event-stream states.
- Replaced the import effect's `refreshing` flag with a status request that waits five seconds before starting the next request. The wait is tied to the abort signal, so cleanup cancels both status fetching and the delay; SSE now only updates connection and progress state.
- Removed the `stopped` wrapper from the status loop. The signal is passed into `refreshStatus` and checked directly after the request and delay.
- Converted absent Audible snapshots from `null` to `undefined` across the service, typed response, routes, SSE subscriptions, client state, and tests. Completed `SnapshotState` so it owns both the optional snapshot and optional UI error, removing the separate error state.
- After the undefined snapshot conversion: server tests 11/11, client Audible tests 7/7, full repository lint, production build, and `git diff --check` passed.
- Added one global API retry overlay for transport and JSON parsing failures. `callApi` and the upload XHR use it; retry resumes the original awaiting caller. POST retries warn that the server may already have completed the action. Authorization failures now use a handler registered once by `AppContextProvider`, with login retaining a custom handler; callers guard the now-truthful undefined response type.
- Global error handling verification: client retry tests cover network failure, malformed JSON, retry continuation, abort cleanup, POST replay warning, and login-specific authorization handling. Client tests 12/12, full repository lint, production build, and `git diff --check` passed.
- After centralizing authorization and correcting nullable API return types: server tests 11/11, client tests 12/12, client lint, client production build, and `git diff --check` passed. No real Amazon sign-in was performed.
- API calls no longer resolve to `undefined`: they return the expected typed response, an explicit `Unauthorized`/`AccessDenied`, or `FetchAborted` for cancellation. Unexpected response types enter the global retry overlay, and the upload XHR adapter also uses explicit outcomes. All affected callers now narrow to their expected response type. Added retry and authorization-result tests; client tests 13/13, server tests 11/11, full repository lint, production build, and `git diff --check` passed.
- Simplified authorization handling: protected calls automatically invoke the global logout handler for both `Unauthorized` and `AccessDenied`; callers pass no callback. The login endpoint alone sets `logOutOnAuthorizationFailure: false` and the login form displays the returned denial message. Client tests 14/14 and TypeScript check passed.
- Updated the Audible progress merge tests for the response-shaped `mergeProgress` result. The focused client tests pass 7/7, the client TypeScript build passes, focused lint passes, and `git diff --check` passes.
- Updated the client Audible tests after the SSE/state helpers moved into `AudibleImport.tsx`: removed tests coupled to the deleted helper module and retained response restoration and API contract coverage. Client tests pass 5/5, server tests pass 11/11, full repository lint and production build pass, and `git diff --check` passes.
- Fixed real-container authentication startup with Libation 14.2.2 by removing the now-invalid empty `Serilog.WriteTo` override. The image smoke check now launches `login-external` through the production PTY and requires an Amazon sign-in URL. Server tests pass 11/11, full lint/build and script tests pass, the rebuilt arm64 image passes the strengthened smoke check, and the local container serves HTTP 200 with prior temporary sessions removed.
- Fixed real Audible redirect submission: Libation returns users to a trusted `audible.* /ap/maplanding` URL, which the original Amazon-only host validation rejected. Added trusted Audible marketplace hosts, kept submission errors visible across background polling, opened the login tab before showing clearer copy instructions, warned about popup blocking, and added optimized iOS/Android address-bar examples. Libation now uses a valid temporary File sink at Fatal level, preventing authentication URLs from entering its default information log while retaining compatibility with 14.2.2. Client tests pass 5/5, server tests pass 11/11, full lint/build and script tests pass. The rebuilt image passes the Libation external-login smoke check and the restarted local container serves HTTP 200 with the rejected session removed.
- Diagnosed the first real downloads from Libation's preserved session database: all 14 attempts completed, but the server's copied macOS FFprobe executable failed with `Exec format error` in the Linux arm64 container. Docker images now explicitly use Debian's native `/usr/bin/ffmpeg` and `/usr/bin/ffprobe` for validation, conversion, and cover extraction. Validation happens once after Libation source fallbacks, preventing a validator failure from downloading the same title three times. Client tests pass 5/5, server tests pass 11/11, script tests pass 3/3, full lint/build pass, and the rebuilt image passed both the runtime smoke check and the server's exact M4B validator. The failed session's temporary credentials and 2 GB of partial audio were removed; the fixed container serves HTTP 200 with the existing database/library mounts.
- Added `audible-import-handoff.md` as the authoritative current-state record. It captures owner decisions that supersede the original plan, architecture and file ownership, authentication and logging constraints, API and TypeScript conventions, automatic container-update policy, diagnosed real-container failures, the latest verification results, and remaining manual acceptance. The original plan and this chronological log link to the handoff so future agents do not treat superseded progress entries as current design.

## Interface contract

- `POST /audible/start` with `AudibleStartRequest` returns `AudibleImportResponse`.
- `POST /audible/redirect` with `AudibleRedirectRequest` returns `AudibleImportResponse` and starts importing after authentication.
- `GET /audible/status` returns `AudibleImportResponse` with an optional snapshot for the current user.
- `GET /audible/events` emits `data: <AudibleImportSnapshot>` (without `loginUrl`) for the current user's active session.
- `POST /audible/cancel` with `AudibleSessionRequest` cancels the session.
- `POST /audible/review` with `AudibleReviewRequest` removes a completed book from the review queue.
- All routes use the existing cookie authentication. Sessions belong to the authenticated user.

## Outstanding manual acceptance

- Authenticate with a real Audible account and verify downloaded source format, chapters and artwork on actual titles.
