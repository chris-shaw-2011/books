FROM alpine AS download

WORKDIR /app

RUN wget -qO- https://github.com/chris-shaw-2011/books/releases/latest/download/transpiled.tar.gz \
	| tar xvz --strip-components=1

FROM node:current-slim

ENV NODE_ENV=production

# Setup working directory
WORKDIR /home/node/app
COPY --from=download --chown=node:node /app /home/node/app

# Release artifact should include production dependencies.
RUN test -d /home/node/app/bin/node_modules || (echo "Missing /home/node/app/bin/node_modules in release artifact." && exit 1)
RUN test -f /home/node/app/bin/projects/server/src/index.js || (echo "Missing compiled server entrypoint in release artifact." && exit 1)

USER node

WORKDIR /home/node/app/bin/projects/server

ENTRYPOINT ["node", "./src/index.js"]
