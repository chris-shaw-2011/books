# syntax=docker/dockerfile:1

# Keep application compilation independent of runtime package refreshes.
FROM node:current-slim AS build
WORKDIR /build
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY projects/client/package.json ./projects/client/package.json
COPY projects/server/package.json ./projects/server/package.json
COPY projects/shared/package.json ./projects/shared/package.json
# Lint tooling is not needed to compile a release. Remove only this dependency
# inside the image; npm ci keeps the remaining dependencies locked.
RUN npm pkg delete 'devDependencies.@chris-shaw-2011/lint' \
	&& npm ci --include=dev --engine-strict

COPY projects ./projects
COPY scripts/copy.ts ./scripts/copy.ts
COPY tsconfig.base.json .env.production ./
RUN npm run build
RUN cp package-lock.json bin/package-lock.json \
	&& cd bin \
	&& npm ci --omit=dev --engine-strict \
	&& test -f projects/server/src/index.js \
	&& test -f projects/client/index.html

FROM node:current-slim AS runtime

ARG APP_VERSION=dev
LABEL org.opencontainers.image.version=$APP_VERSION
ENV APP_VERSION=$APP_VERSION
ENV NODE_ENV=production
ENV LIBATION_CLI=/usr/local/bin/libationcli
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Native .NET dependencies and FFmpeg support Libation's high quality audio.
ARG APT_REFRESH
RUN apt-get update \
	&& DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
	&& apt-get install -y --no-install-recommends \
	ca-certificates curl libgssapi-krb5-2 libstdc++6 libgcc-s1 zlib1g ffmpeg \
	&& icu_package="$(apt-cache pkgnames | grep -E '^libicu[0-9]+$' | sort -V | tail -1)" \
	&& ssl_package="$(apt-cache pkgnames | grep -E '^libssl[0-9]+(t64)?$' | sort -V | tail -1)" \
	&& apt-get install -y --no-install-recommends "$icu_package" "$ssl_package" \
	&& rm -rf /var/lib/apt/lists/*
COPY scripts/install-libation.sh /tmp/install-libation.sh
COPY scripts/resolve-libation-release.ts /tmp/resolve-libation-release.ts
ARG LIBATION_PACKAGE_URL
# This digest is a cache key, not a checksum validation.
ARG LIBATION_RELEASE_SHA256
RUN sh /tmp/install-libation.sh "$LIBATION_PACKAGE_URL" \
	&& rm /tmp/install-libation.sh /tmp/resolve-libation-release.ts

WORKDIR /home/node/app
COPY --from=build --chown=node:node /build/bin ./bin
COPY --chown=node:node scripts/check-docker-runtime.ts ./check-docker-runtime.ts

USER node

WORKDIR /home/node/app/bin/projects/server
ENTRYPOINT ["node", "./src/index.js"]
