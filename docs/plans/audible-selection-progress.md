# Audible selection implementation plan and progress

Updated: October 27, 2026. This document is the resume point for the user-controlled Audible import update. Read `audible-import-handoff.md` for existing constraints. Supersedes automatic downloading and the separate first-book-only review presentation in the original plan.

## Intended behavior

After authentication, scan/export metadata only. Present titles and optional covers with no books selected by default; allow individual selection and select all available titles. Existing ASIN matches are marked already imported and cannot be selected. Download only after an explicit confirmation. Sequential downloads retain an individual progress/status row for every title. Completed rows render the existing `BookLink` flow in place, honoring administrator editing and reader status permissions. Closing/reopening recovers server state. Keep narrow screens usable.

## Shared contract

- Add phase `selecting`.
- Snapshot required `books: AudibleImportItem[]`: a server-built folder tree with `Directory` nodes and `AudibleImportBook` leaves. Each book occurs once; `audibleBooks` derives the leaves for status and selection logic.
- `AudibleImportBook` extends `Book`. Book metadata uses the inherited fields, including `name`, `cover`, `series`, `seriesOrder`, and `folderPath`. Import-specific fields are `importStatus` (`available`, `skipped`, `queued`, `downloading`, `complete`, `failed`, `cancelled`), `percentage`, `reviewed`, `padding`, and `seriesOptions` for alternative series.
- Completed rows hold the published metadata directly. Pending reviews are completed, unreviewed rows; there is no nested book or separate review queue. The response class restores every row as an `AudibleImportBook`. Review acknowledges the matching row without deleting it.
- Add typed `AudibleSelectionRequest { sessionId, asins: string[] }`, export and API message union entry; POST `/audible/select`; service `select(owner, id, asins)`; client method `audibleSelect(sessionId, asins, onFailure)`.
- Selection validates phase, ownership, nonempty array, unique known available ASINs. Repeat identical submissions during downloading/completion must be safe against HTTP replay; changed/invalid submissions are rejected.
- Retain temporary session until selection/cancellation with bounded idle expiry and shutdown cleanup; no downloads during discovery or selection. Recheck ASIN under existing download lock.

## Work packages and ownership

1. Backend agent: shared contract, server lifecycle/routes, server tests. Implement bounded selection wait/cancel/expiry; safe cover extraction from Libation export; individual progress and completion data; regression tests for opt-in boundary, subset, invalid/replayed selection, cancellation, failure, cleanup and HTTP permissions.
2. Frontend agent: client component/styles/API/client tests. Preserve pre-existing uncommitted sign-in changes. Implement responsive selection and per-book rows; in-place completed components; refresh/reopen state; typed selection request coverage.
3. Primary agent: integration review, full tests/lint/build, user documentation, final progress record. Audit race/cancel cleanup and permission behavior. No real credentials or running deployment modifications.

Use two scoped subagents with concise tasks and inherited model; no redundant exploration or nested delegation. Shared files belong exclusively to backend agent. Agents report checks and limitations; primary resolves integration issues.

## Progress

- Done: Read prior Audible plans and implementation; identify and preserve existing client changes.
- Done: Record implementation plan, contract, ownership and resume instructions.
- Done: Backend/shared implementation and tests: 18/18 server tests; server/shared TypeScript and lint passed.
- Done: Frontend implementation and tests: 6/6 client tests, client lint and production client build passed.
- Done: Integrated review and fixes, including narrow-screen admin labels.
- Done: Full tests passed (server 18, client 6, scripts 3); full repository lint, production build, script TypeScript and diff checks passed.
- Done: Updated current handoff, historical progress API contract, and interactive acceptance instructions. Implementation ready for real-account acceptance.

## Verification and remaining acceptance

Implementation and automated verification complete. No real Amazon credentials were used and no running deployment was modified. Real-account acceptance must confirm scan causes no downloads, subset and select-all behavior, cover availability, per-title progress, in-place admin/reader display, mobile layout, refresh/reopen, cancellation and cleanup. Never copy or print real credentials.

## Integration review log

- Two scoped agents completed their work without nested delegation. All original sign-in improvements preserved.
- Added specific selection-expiry copy and automatic cleanup when all discovered titles already exist.
- Verified upstream Libation export uses PictureId/PictureLarge; thumbnail URL handling covers these as well as HTTPS image URLs.
- Browser fixture checks opt-in selection, select-all excluding duplicates, subset request, inline reader completion/acknowledgment and current metadata, admin controls and layouts at 320/360/390/1024 px. Found and fixed shrinking field labels in narrow admin editors.
- All 27 tests pass (18 server, 6 client, 3 scripts), including mocked HTTP authentication/discovery/selection with real M4B publication, ASIN duplicate checks, review retention, cancellation/expiry/shutdown cleanup and authorization. Full repository lint and production TypeScript/Vite build pass; script TypeScript check and `git diff --check` pass.

- Browser verification completed successfully using a temporary Vite/Chrome DevTools fixture: explicit subset payload, select-all behavior, per-row 42% progress, inline reader/admin completion, review acknowledgment, current library metadata and editor cancellation. No horizontal overflow at 320/360/390/1024 px and no browser runtime exceptions. Temporary workspace harness removed and browser/server stopped. Screenshots remain under `/tmp/books-audible-{select,reader,admin}-mobile.png`.

- Production image `books-audible:selection-verify` built successfully from the existing Dockerfile on the local host architecture. Isolated smoke check passed for Libation 14.2.2, external login under a real PTY, native FFprobe, writable staging and non-root execution. Build log: `/tmp/books-audible-selection-docker.log`. The temporary smoke configuration is removed by the check; the disposable container was removed automatically. No existing local acceptance container was replaced.

## Resume / manual acceptance

There is no remaining implementation work identified. Changes are uncommitted. For interactive acceptance, follow `docs/audible-docker.md` using a real Audible account: confirm discovery downloads nothing, then select a subset and confirm only those books download. Repeat with select-all, phone layout, cover images, per-book progress, admin edits/folder moves, reader status, review completion, close/reopen/refresh and cancellation. Waiting for selection expires after 30 minutes. Already-imported-only scans finish immediately and remove credentials.

Progress uses a determinate percentage when Libation supplies one and an indeterminate bar otherwise; real title/marketplace output and cover availability still need interactive acceptance. Unsaved selection checkboxes reset on a full reopen; confirmed selections and downloaded/completed rows recover from the backend. Existing sessions are in memory and do not survive server restart, which removes their temporary credentials.

Follow-up: Hide unselected (`available`) rows after leaving the selection step, including during downloading and after completion. Selected books retain their progress and completed-book rows.

Follow-up: Expand the library/import/review dialog to a maximum width of 90rem, constrained by the viewport and existing mobile margins. Authentication and new-import setup retain the compact 36rem layout.

Follow-up: Fixed download percentages by parsing Libation's actual `[###...]` terminal bars, not only numeric percent strings. The streaming parser buffers split PTY frames, strips ANSI sequences, handles backspace redraws, selects the latest complete frame and suppresses unchanged updates. Existing per-book percentage labels and native progress bars now receive measured progress through snapshots/SSE. Upstream renderer verified in [ConsoleProgressBar.cs](https://github.com/rmcrackan/Libation/blob/master/Source/LibationCli/ConsoleProgressBar.cs). Server tests now pass 20/20, including terminal parser tests and HTTP integration using a split Libation bar; server lint and production build passed. Actual-account download output still requires interactive acceptance.

Follow-up: Place previously imported titles last while preserving order within each group. Replace their disabled checkbox with an accessible green check badge, green row accent/tint and grayscale cover, including in dark displays. Remove redundant available/imported status lines. Enlarge discovery covers to 6rem (5rem on phones).

Selection presentation: The server groups source series into their suggested library folders before returning status or SSE snapshots. Selection uses the normal folder and book rows; CSS changes their size and marks selected rows. Available exported author, narrator, description, category, publication year and duration populate the inherited Book fields. Native folder disclosures retain selection controls while collapsed and reveal invalid selected books during form validation.
