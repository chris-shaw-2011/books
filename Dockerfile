FROM alpine AS download

WORKDIR /app

RUN wget -qO- https://github.com/chris-shaw-2011/books/releases/latest/download/transpiled.tar.gz \
	| tar xvz --strip-components=1

FROM node:current-slim

ENV NODE_ENV=production
ENV LIBATION_CLI=/usr/local/bin/libationcli
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

ARG APT_REFRESH
RUN : "$APT_REFRESH" && apt-get update \
	&& DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
	&& apt-get install -y --no-install-recommends \
	ca-certificates curl libgssapi-krb5-2 libstdc++6 libgcc-s1 zlib1g ffmpeg \
	python3 make g++ \
	&& icu_package="$(apt-cache pkgnames | grep -E '^libicu[0-9]+$' | sort -V | tail -1)" \
	&& ssl_package="$(apt-cache pkgnames | grep -E '^libssl[0-9]+(t64)?$' | sort -V | tail -1)" \
	&& test -n "$icu_package" && test -n "$ssl_package" \
	&& apt-get install -y --no-install-recommends "$icu_package" "$ssl_package" \
	&& rm -rf /var/lib/apt/lists/*
ARG LIBATION_RELEASE_SHA256
COPY scripts/install-libation.sh /tmp/install-libation.sh
COPY scripts/resolve-libation-release.ts /tmp/resolve-libation-release.ts
RUN LIBATION_RELEASE_SHA256="$LIBATION_RELEASE_SHA256" sh /tmp/install-libation.sh \
	&& rm /tmp/install-libation.sh /tmp/resolve-libation-release.ts

# Setup working directory
WORKDIR /home/node/app
COPY --from=download --chown=node:node /app /home/node/app
COPY --chown=node:node scripts/check-docker-runtime.ts ./check-docker-runtime.ts

# Release artifact should include production dependencies.
RUN test -d /home/node/app/bin/node_modules || (echo "Missing /home/node/app/bin/node_modules in release artifact." && exit 1)
RUN test -f /home/node/app/bin/projects/server/src/index.js || (echo "Missing compiled server entrypoint in release artifact." && exit 1)
RUN cd bin && npm rebuild node-pty \
	&& apt-get purge -y --auto-remove python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

USER node

WORKDIR /home/node/app/bin/projects/server

ENTRYPOINT ["node", "./src/index.js"]
