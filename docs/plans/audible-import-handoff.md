# Audible import handoff

Last updated: October 23, 2026

Selection update: see [`audible-selection-progress.md`](./audible-selection-progress.md) for the implementation plan, current verification results and resume instructions. This update supersedes automatic downloads and the first-completed-book-only review UI described in the original plan.

This is the current-state handoff for the Audible import feature. The original requirements are in [`audible-import.md`](./audible-import.md), and [`audible-import-progress.md`](./audible-import-progress.md) is a chronological implementation log that includes approaches later revised. When those documents differ, verify the current source and use this handoff for the decisions made during implementation.

## Current status

- Work is on `feature/audible-import` and has not been committed yet.
- The complete mocked workflow, production build, lint, and Docker runtime checks pass. The October 23 selection update passes 18 server tests, 6 client tests and 3 script tests, mobile browser checks at 320–390 px plus desktop, and a fresh production Docker build/runtime smoke check.
- A real Audible login has successfully completed, the library was scanned, and real titles were downloaded by Libation.
- The first real downloads exposed a container FFprobe architecture problem. That issue is fixed, the image was rebuilt, and the user reports that preliminary real-account testing now passes.
- Full manual acceptance across purchased titles, Audible Plus, duplicate imports, permissions, queue handling, cancellation, and several source formats is still recommended before release.

## Product and implementation decisions

### Authentication and credential lifetime

- Authentication uses Libation's interactive `login-external` process under `node-pty`. Books never asks for or receives the Amazon password.
- Each import gets an isolated directory under the operating system temporary directory. `HOME`, XDG paths, `TMPDIR`, and `LIBATION_FILES_DIR` all point to that directory for the Libation child.
- The pasted redirect is written only to the existing PTY. It is never placed in argv, an API response, an activity message, or an application log.
- Login URLs may use a supported `amazon.*` host and completed redirects may use the corresponding `audible.* /ap/maplanding` host. Redirects must use HTTPS and contain `openid.oa2.authorization_code`.
- SSE snapshots deliberately omit `loginUrl`. Authenticated JSON start/status responses may include it while the login is waiting.
- Libation logging uses a temporary Fatal-level file sink. An empty `Serilog.WriteTo` array is invalid in Libation 14.2.2, and default information logging can record the login URL.
- Session directories are removed after success, failure, cancellation, graceful shutdown, and startup cleanup. No reusable Audible login is retained for a later import.

### Browser sign-in experience

- The client opens `about:blank` immediately from the click handler, checks whether the browser blocked it, detaches `opener`, and then navigates it to Libation's URL. This preserves the browser's user-gesture popup permission.
- The alert and page explain that the final Amazon/Audible page may appear broken and that the user must copy the entire browser address, rather than text from the page.
- The iOS Safari and Android Chrome examples are intentionally bundled WebP assets in `projects/client/src/assets`.

### Imports, duplicates, and files

- The server Audible implementation belongs in `projects/server/src/audible`. Client files remain in the existing client layout; there is no client `audible` folder.
- Libation scans and exports the account library, then waits for explicit selection before any download. The user chooses individual titles or all available titles; nothing is selected by default. Books invokes targeted `liberate <ASIN>` commands sequentially for confirmed selections only. Podcasts and podcast episodes are excluded. Selection waits expire after 30 minutes and clean up temporary credentials.
- Download preference is high quality with Widevine and xHE-AAC. A failed Libation download retries without xHE-AAC and then without Widevine. Validation happens once after a completed source download, so validator failures do not download the same audiobook three times.
- Audible discovery only accepts M4B output. MP3 files are irrelevant to this workflow and are not searched for ASINs here.
- ASIN is a property of `Book`, populated during normal server library loading from embedded M4B metadata. Duplicate detection queries the in-memory book tree.
- A missing ASIN is the empty string. It is not `null`, `undefined`, an exception, or a separately validated value. The import trusts a nonempty embedded ASIN.
- Imported ASINs are written into the Apple M4B metadata. Moving or renaming a book preserves duplicate detection; deleting it removes it from the in-memory library after watcher processing.
- Completed audio is copied to a hidden staging name on the upload filesystem and hard-linked to its final `.m4b` name. This keeps partial files away from the watcher, handles cross-filesystem publication, avoids overwrite, and adds numeric suffixes for collisions.

### API and TypeScript conventions

- Audible endpoints return `AudibleImportResponse`, matching the application's typed message protocol. The SSE endpoint emits an `AudibleImportSnapshot` because it is a stream rather than a normal API response.
- `AudibleImportResponse` allows an optional snapshot and optional error. The client may deliberately retain the last snapshot while displaying a request or redirect error, so those fields are not modeled as a mutually exclusive union.
- Client endpoint methods live on `LoggedInApiClass` and use the shared `callApi` path. There is no separate `AudibleApi` class and no Audible-only response/failure wrapper layer.
- Fastify routes use small named request interfaces such as `AudibleStart` so declarations remain `server.post<AudibleStart>(...)`. Shared request validation pre-handler values live in `Validation.ts`.
- Absent snapshots use `undefined` throughout. `null` is not part of the snapshot model. With `exactOptionalPropertyTypes`, `AudibleImportResponse.snapshot` explicitly includes `| undefined` because route code assigns to the property after construction.
- The client keeps one response-shaped import state containing the optional snapshot and optional error. `busy` represents a user request and `connected` represents SSE connectivity; they describe independent conditions.
- The status loop uses one `AbortController` for the request and five-second delay. Cleanup aborts the request/delay and closes the SSE connection. Avoid reintroducing `live`, `refreshing`, `nextStatusCheck`, or a wrapper around `signal.aborted`.
- Standalone repository scripts are TypeScript run directly by the current Node release. Do not convert them back to CJS or add a TypeScript runtime package.
- Server, shared, test, and directly executed script imports retain explicit `.ts` extensions where the repository's Node TypeScript convention requires them. Client imports continue to follow the existing Vite convention.

### Permissions and completed-book display

- Reading status is account-level and remains available to non-administrators. It is independent of global metadata and folder editing permissions.
- `CompletedBook.tsx` is shared by manual uploads and Audible imports. Administrators receive the existing edit flow; non-administrators receive the normal book display without metadata or folder editing controls.
- Server authorization on metadata updates remains authoritative. An API test verifies that a non-admin cannot bypass the client and update metadata directly.
- The review queue stores `Book` objects. ASIN comes from `Book.asin`; there is no parallel queue ASIN field. Snapshot `books` rows retain individual status, progress, optional cover and completed `Book` data. Each completed row renders the existing permissions-aware book component in place; acknowledging review leaves the row visible.

### Docker and automatic updates

- The Dockerfile intentionally uses `node:current-slim`. The project owner prefers automatic current software even when an update may require a follow-up fix; do not pin it to `current-bookworm-slim` or another older base merely for stability.
- The final image runs `apt-get upgrade`. The daily workflow checks Debian upgrades against the **last published Books image**, rather than comparing against the freshly resolved base image.
- A daily build is triggered by a changed base digest, changed Libation package digest, relevant container source changes, available upgrades in the last published image, or a new application release. An unchanged daily run does not upload another image.
- There is no separate `checkcontainer.yml`. The project does not use pull requests, and the owner chose to keep the pre-publish verification in `build-container.yml` rather than run a redundant push check.
- Libation is resolved from the latest upstream release at build time and verified with the release SHA256. This follows the same automatic-update preference as the Node base.
- The automatic latest Libation/base policy intentionally supersedes the original plan's request for a pinned compatible Libation version. The owner prefers receiving updates automatically and fixing regressions over remaining on older software.
- The image uses Debian's native `/usr/bin/ffmpeg` and `/usr/bin/ffprobe` through `FFMPEG_PATH` and `FFPROBE_PATH`. This is required because release `node_modules` may contain a static binary for the machine that prepared the artifact.
- `node-pty` is rebuilt inside the Linux image. Compiler packages are removed afterward, and the application continues to run as the non-root `node` user.

## Architecture map

| Area | Primary files |
| --- | --- |
| Shared session and response types | `projects/shared/src/AudibleImport.ts`, `projects/shared/src/api/AudibleImportResponse.ts`, `projects/shared/src/api/Audible*Request.ts` |
| Backend lifecycle and Libation adapter | `projects/server/src/audible/ImportService.ts` |
| Backend publication and ASIN metadata | `projects/server/src/audible/Files.ts`, `projects/server/src/AudioMetadata.ts`, `projects/server/src/BookList.ts` |
| HTTP and SSE routes | `projects/server/src/audible/Routes.ts`, `projects/server/src/server.ts` |
| Client workflow | `projects/client/src/app/AudibleImport.tsx`, `projects/client/src/app/AudibleImport.module.scss` |
| Typed client API | `projects/client/src/app/api/LoggedInApi.ts`, `projects/client/src/app/api/BaseApi.ts` |
| Completed-book permissions | `projects/client/src/app/CompletedBook.tsx`, `projects/client/src/app/Authenticated.tsx` |
| Docker installation and checks | `Dockerfile`, `scripts/install-libation.sh`, `scripts/resolve-libation-release.ts`, `scripts/check-docker-runtime.ts` |
| Publishing policy | `.github/workflows/build-container.yml`, `scripts/check-apt-updates.sh` |
| Tests | `projects/server/test/audible`, `projects/client/test/audible.test.ts`, `scripts/*.test.ts` |

## Real-container failures already diagnosed

### Libation failed before showing a login link

Libation 14.2.2 rejected `Serilog.WriteTo: []`. The working configuration uses a temporary Fatal-level file sink. The smoke check now starts `login-external` in a real PTY and waits for an Amazon login URL, so a regression fails the image build.

### Completed redirect flashed an error

Libation generated `openid.return_to=https://www.audible.com/ap/maplanding`, while the first URL validator accepted only Amazon hosts. Supported Audible marketplace hosts are now trusted for `/ap/maplanding`, and the client merge logic preserves explicit redirect errors instead of immediately clearing them with a status poll.

### Every real title downloaded three times and failed

Libation's preserved database showed 14 successful downloads. Books then ran a macOS static FFprobe executable inside the Linux arm64 image, which failed with `Exec format error`. Docker now sets native FFmpeg/FFprobe paths, the smoke test creates and probes a real M4B, and the exact server validator was exercised inside the rebuilt production container.

### Browser showed `NetworkError when attempting to fetch resource`

Docker Desktop's daemon had stopped. The container exit was 255, with `OOMKilled=false` and no application exception. Restarting Docker and the rebuilt container restored the application. The failed session's temporary credentials and approximately 2 GB of staging data were removed.

## Latest verification record

The following passed after the native FFprobe fix:

- Client tests: 5/5.
- Server tests: 11/11, including mocked Libation, real M4B validation, HTTP integration, authorization, cleanup, partial failure, and fallback behavior.
- Standalone script tests: 3/3.
- Full repository lint.
- Production TypeScript and Vite build.
- `git diff --check`.
- Production Docker build from `Dockerfile`.
- Runtime smoke check for Libation 14.2.2, external login through `node-pty`, native FFprobe, writable staging, and non-root execution.
- Exact `validateM4b` execution inside the production container.
- Application HTTP response 200 from inside the restarted container.
- Failed-session credential and staging directory cleanup.

## Remaining manual acceptance

Use [`../audible-docker.md`](../audible-docker.md) for the full checklist. At minimum, complete these before release:

1. Finish imports for at least one purchased title and one available Audible Plus title.
2. Inspect the resulting files for playback, chapters, cover art, source codec, ASIN metadata, and immediate library availability.
3. Repeat the import to verify ASIN skips, then rename/move and delete a title to verify duplicate behavior follows the file.
4. Exercise administrator and non-administrator completed-book displays, including reading status and direct metadata-update authorization.
5. Exercise multiple queued books, modal close/reopen, browser refresh, SSE reconnect, one failed title followed by a successful title, cancellation, and abandoned authentication.
6. Confirm no account/token files remain and no login or redirect URLs appear in application logs after success, failure, cancellation, and restart.

## Local container used for acceptance

The local image and container names are `books-audible:local` and `books-audible-local`. The test mounts preserve the Books database and library while keeping Audible temporary files separate:

```sh
docker build -f Dockerfile -t books-audible:local .
docker run --rm --network none --entrypoint node books-audible:local /home/node/app/check-docker-runtime.ts
docker run -d --name books-audible-local --init \
  -p 127.0.0.1:3001:3001 \
  -e NODE_ENV=production \
  -e BOOKS_DB_LOCATION=/data/db.sqlite \
  -v /tmp/books-audible-local/data:/data \
  -v /tmp/books-audible-local/library:/library \
  -v /tmp/books-audible-local/tmp:/tmp \
  books-audible:local
docker logs -f books-audible-local
```

Run `npm run build` and refresh the production dependencies under `bin` before rebuilding if source dependencies changed. Do not preserve or copy a real session directory while debugging; inspect only the minimum safe metadata needed, redact sensitive output, and remove the directory after diagnosis.
