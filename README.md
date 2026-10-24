
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

Change `package.json`'s version explicitly (for example, `npm version patch --no-git-tag-version`,
which also updates `package-lock.json`) and push to the default branch. Release checks
the version against `package.json` at the `latest` Git tag. When it differs (or
`latest` is missing), it creates an immutable Git tag such as `1.6.1`,
and moves the lightweight `latest` Git tag to that commit. It then calls the container
workflow directly; it does not depend on tag pushes triggering another workflow.
There are no compiled release archives. Manual application releases use explicit
version bumps; compatible dependency updates can create patch releases automatically.

CI uses the same Dockerfile as local builds and persists the intermediate build cache.
It smoke-tests the candidate image before pushing versioned and `latest` image tags
to GHCR. The daily container check rebuilds the source at the `latest` Git tag only
when Node's base image, Libation, or Debian packages change. Unreleased branch changes
are not included. Moving Node/OS/Libation versions and the target CPU architecture can
still change build results; the shared Dockerfile guarantees the same build process.

Release handles explicit application version bumps on `master`. Update is the only
scheduled workflow: it runs daily and can also be started manually. Both use
`scripts/tag-version.sh` to compare the application version with the `latest` Git
tag and publish immutable version tags. Both call the shared Build Container
workflow to check, build, verify, and publish an image. Build Container has no
schedule or standalone trigger.

Update first checks npm without installing packages or compiling the application.
It runs `npm update --package-lock-only --ignore-scripts` across the workspaces,
respecting existing dependency ranges and overrides. For example, a `^5.0.0`
dependency can receive compatible 5.x updates, while an exact version stays pinned.
It then runs `npm audit fix --package-lock-only --omit=dev --ignore-scripts` to
apply compatible security fixes for production dependencies. Dev-only advisories are
excluded from that pass. Neither command installs packages, runs lifecycle scripts,
or forces incompatible upgrades. Unresolved advisories remain visible in the logs
without blocking other updates; registry or command errors still fail the check.

When the lockfile changes, Update commits it with an application patch-version bump
to `master`, then runs the shared version-tagging script. A committed version that
was not tagged due to a failed run is retried on the next check. There is no workflow
dispatch chain or extra trigger token. GitHub's built-in token reads the private
lint package and writes dependency commits; local Docker builds need no token.
The repository must allow the workflow to push to `master`.

Update then calls Build Container even when npm is unchanged, so it can check for
Node base image, Debian package, and Libation updates. Unchanged inputs skip the
image build. New application/dependency versions or changed runtime components
produce one candidate image, which is smoke-tested before publication. Docker
reuses the application build stage when only runtime layers change; a Node base
image change also rebuilds the native dependencies. No application compilation
runs merely because the daily schedule fired.

Start Release manually on `master` to initialize tags, or let Update initialize
them on its next run. To retry a failed build, rerun the failed jobs or start Update.
Existing version tags must identify the exact versioned commit. If tagging succeeded
but building failed, unchanged runtime checks detect the missing published version
and retry it. Failed builds leave the previously published image in place. Compatible
version numbers alone cannot guarantee a regression-free update.

## Scripts

- `npm start` - Start client and server in development
- `npm run build` - Build all packages for production
- `npm run lint` - Run lint checks
- `npm run analyze` - Analyze client bundle size

For Audible container requirements, image checks, and interactive account testing, see [Audible import container verification](docs/audible-docker.md).

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
