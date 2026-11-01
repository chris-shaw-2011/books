
# Books Monorepo

## Overview

This application is an audiobook management platform. It allows users to organize, track, and convert audiobooks, manage user accounts, and interact with their audiobook library through a modern web interface. The backend provides APIs for book management, conversion, and user authentication, while the frontend offers a responsive UI for browsing and managing books.

## Features

- Manage a library of audiobooks (add, edit, delete)
- Track read/unread status and metadata for each book
- Upload and convert audiobook files (e.g., zip of mp3s to m4b)
- Import purchased and Audible Plus audiobooks on demand through Libation with temporary Amazon authentication
- Automatic metadata extraction and modification
- User authentication and account management
- Settings management via web interface
- Dockerized deployment for easy setup
- Fast, modern React frontend (Vite)
- RESTful Fastify backend
- Shared TypeScript types for type safety across client and server

This is a monorepo for a full-stack audiobook management application, including a React client (Vite), Fastify server, and shared TypeScript types.

## Structure

- `projects/client`: React frontend (Vite)
- `projects/server`: Fastify backend
- `projects/shared`: Shared TypeScript types and utilities
- `bin/`: Production build output

## Getting Started

### Prerequisites
- Node.js >= 26.5.0
- npm >= 10.9.2
- Docker + Docker Compose (for containerized run)

### Run with Docker (Published Image)

Pull only the latest `docker-compose.yml` from the remote repo:

```sh
git fetch origin && git checkout origin/HEAD -- docker-compose.yml
```

Start the container:

```sh
docker compose up -d
```

### Install dependencies

```sh
npm install
```

### Development

Start both client and server:

```sh
npm start
```

Client: [http://localhost:3000](http://localhost:3000)
Server: [http://localhost:3001](http://localhost:3001)

JSON inputs are validated against the existing TypeScript models with Typia. The npm scripts run its transform through `ttsc`, `ttsc/register`, and the Vite plugin; use `node --require ttsc/register path/to/script.ts` when running a TypeScript entry point directly. Type changes automatically update the checks on the next run or build, without separate schema files or a generation command. Typia usage belongs in `projects/shared`; callers pass `JSON.parse` results to the shared model’s `fromUnknown` factory for validation. Constructors accept typed data, retain defaults, and restore dates and nested class instances. A cold build compiles and caches Typia’s native plugin, so it takes longer than subsequent builds. Tests use one file worker to avoid concurrent compiler-loader emits for the same project.

### Build for Production

```sh
npm run build
```

### Lint

```sh
npm run lint
```

### Build and test the production image locally

Docker installs dependencies, compiles the client/shared/server projects, and packages
production assets. No host npm install, build, or package-registry token is needed.
The private lint dependency is excluded inside the build stage. Run:

```sh
docker build --pull -t books:local .
docker run --rm --network none --entrypoint node books:local /home/node/app/check-docker-runtime.ts
```

To run through Compose with your local data, copy
`docker-compose.override.yml.example` to `docker-compose.override.yml`, enable its
commented local image/build/pull-policy settings, and run
`docker compose up -d --build`. The default Compose configuration uses the published
image instead.

### Publishing versions

Set a new three-part version in `package.json`, synchronize `package-lock.json`
(as described below), and push to the default branch. **Release application** checks
the version against `package.json` at the `latest` Git tag. When it differs (or
`latest` is missing), it creates an immutable Git tag such as `1.6.1`,
and moves the lightweight `latest` Git tag to that commit. It then calls the container
workflow directly; it does not depend on tag pushes triggering another workflow.
There are no compiled release archives. Manual application releases use explicit
version bumps; compatible dependency updates use a fourth component in Git tags.

CI uses the same Dockerfile as local builds and persists the intermediate build cache.
It smoke-tests the candidate image before pushing versioned and `latest` image tags
to GHCR. Starting Release manually also rebuilds an already-tagged version, using
its existing application tag and a new container revision. The daily container check rebuilds the source at the `latest` Git tag only
when Node's base image, Libation, or Debian packages change. Unreleased branch changes
are not included. Moving Node/OS/Libation versions and the target CPU architecture can
still change build results; the shared Dockerfile guarantees the same build process.

**Release application** handles explicit application version bumps on `master`.
**Daily dependency & runtime updates** is the only scheduled workflow: it runs daily
and can also be started manually. Release owns version comparison and Git tagging
through `scripts/tag-version.sh`. When Update commits a dependency version, it
explicitly dispatches Release for that exact commit and skips its own container
checks. When production dependencies are unchanged, Update calls **Check & publish container**
directly for runtime-only updates. The shared container workflow has no schedule
or standalone trigger.

The shared workflow accepts one optional input, `version_tag`. Release supplies
the application tag to build. Update leaves it empty to check runtime updates for
Git `latest`, building only when a runtime component changed.

Update checks only production npm dependencies without installing packages or
compiling the application. `scripts/update-production-dependencies.ts` selects the
production dependency names from the lockfile, including transitive dependencies,
and updates them within their existing ranges. For example, a `^5.0.0` dependency
can receive compatible 5.x updates, while an exact version stays pinned.

It also runs a production-only, lockfile-only `npm audit fix` without lifecycle
scripts or `--force`. Unresolved advisories remain visible in the logs without
blocking other updates; registry or command errors still fail the check. Dev-only
changes and lockfile metadata changes are discarded when no production dependency
versions, sources, integrity hashes, or installed paths changed. Development
packages, including TypeScript, Vite, esbuild, and lint tooling, are updated manually
alongside code releases.

When production dependencies change, Update increments the fourth component in
`package.json` and synchronizes both root version fields in `package-lock.json`.
For example, `1.7.0` becomes `1.7.0.1`, then `1.7.0.2`. It commits the manifests
and lockfile, then requests Release, which tags that exact version, moves Git
`latest`, and builds the image. The Release run title includes the requested
version and identifies dependency updates as its source. Each run links to the
other in its summary. A successful Update handoff means Release was requested;
the separate Release run reports whether the image was published.

This private app supports four-part versions in npm installation and builds, but
four-part versions are not SemVer: `npm version` cannot manage them. Automatic
increments use `scripts/bump-update-version.ts`. For a code release, explicitly
set the next three-part version (for example, `npm pkg set version=1.7.1`) and
synchronize the lockfile with `npm install --package-lock-only --ignore-scripts`
before committing. That resets the automatic sequence; its next update is `1.7.1.1`.

If the Release handoff fails after a dependency commit, rerun the failed dispatch
job or start Release manually. Update does not look for unreleased commits.
GitHub's built-in token reads registry metadata, writes dependency
commits and dispatches Release; no extra trigger token is needed. Pushes using that
token do not themselves trigger Release. The dispatch job has `actions: write`.
Update and Release share one concurrency group; Update requests Release without
waiting, then exits so Release can start. Local Docker builds need no token.
The repository must allow the workflow to push to `master`.

Maintenance script unit tests run in **Test maintenance scripts** when `scripts/**`, the
Dockerfile, or workflow files change. They do not run as part of daily maintenance.
Candidate images still run the functional Libation login and audio smoke checks
before publication. Libation asset digests are update/cache keys, not download
checksum validation.

When production dependencies are unchanged, Update calls the shared container workflow
to check for Node base image, Debian package, and Libation updates at Git `latest`.
Unchanged inputs skip the image build. New application/dependency versions or changed runtime components
produce one candidate image, which is smoke-tested before publication. Docker
reuses the application build stage when only runtime layers change; a Node base
image change also rebuilds the native dependencies. No application compilation
runs merely because the daily schedule fired.

The Actions list uses explicit run titles to distinguish release requests, daily
updates, manual updates, and maintenance tests. Run titles describe the trigger;
GitHub evaluates them before update results are known. The run summary shows the
actual dependency changes and container decision. Container checks and publishing
are separate jobs: the publish job displays the target version and all build
reasons, or is skipped when nothing changed. Dependency commits, tag creation,
Release dispatch, container-only checks, and Debian checks are also skipped when
they are unnecessary. Publication summaries
report build, smoke-check, and push outcomes, including failures.
Checks use the maintenance scripts from the workflow's own commit; application
metadata and Docker builds still use the selected application tag. Workflow-only
improvements therefore do not require an application release to take effect.

Published container tags always have five numeric components. A code release
`1.7.0` first builds image `1.7.0.0.0`; dependency revision `1.7.0.1` builds image
`1.7.0.1.0`. Further Node, Debian, or Libation rebuilds for that same source use
`1.7.0.1.1`, `1.7.0.1.2`, and so on. The fourth component tracks dependency updates;
the fifth tracks container rebuilds. `latest` still points to the newest published
image. Existing historical tags are preserved.

Start Release manually on `master` to initialize tags or recover a failed release.
It rebuilds even when that application version is already tagged; no version bump
is needed. Update does not detect missing publications or repair failed releases.
Existing version tags identify the exact versioned commit. Concurrency serializes
Update and Release runs; there is no additional handling for rerunning obsolete
jobs after a newer release. Use a manual Release of the current version to recover.
Compatible version numbers alone cannot guarantee a regression-free update.

## Scripts

- `npm start` - Start client and server in development
- `npm run build` - Build all packages for production
- `npm run lint` - Run lint checks
- `npm test --workspaces --if-present` - Run client and server tests
- `npm run test:scripts` - Run maintenance script tests
- `npm run analyze` - Analyze client bundle size

For Audible container requirements, image checks, and interactive account testing, see [Audible import container verification](docs/audible-docker.md).

Audible imports include series organization in the book selection step for administrators.
Selected series books show an editable folder, reading order, and destination preview
before downloading. The default uses Audible's series position, reuses matching library
folders and their numbering style, and otherwise uses `Series/01 - Title.m4b`.
Series order is numeric; prequels and novellas can use values such as `0` and `2.5`.
Missing positions and ranges stay unset until reviewed. Multiple-series books require
choosing a series; books without series data stay in the configured upload folder.
Audible supplies the initial series order; edits replace that same value in the
audio file and the existing book editor. Imports by
non-administrators continue to use the upload folder. Existing library files are not
reorganized by an import.

## Todo
Add manage users page<br />
Reset password<br />
Persist read books<br />
Allow upload of zip of mp3s<br />
Modification of metadata<br />
Modify settings via web interface<br />
Automatic download of all books in an audible account and convert to m4b<br />

## Todo
Add manage users page<br />
Reset password<br />
Persist read books<br />
Allow upload of zip of mp3s<br />
Modification of metadata<br />
Modify settings via web interface<br />
Automatic download of all books in an audible account and convert to m4b<br />
