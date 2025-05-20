FROM alpine AS download

WORKDIR /app

RUN wget -qO- https://github.com/chris-shaw-2011/books/releases/latest/download/transpiled.tar.gz \
	| tar xvz --strip-components=1

FROM node:24-slim

RUN apt update
RUN apt upgrade -y

# Setup working directory
WORKDIR /home/node/app
COPY --from=download /app /home/node/app

# Install production dependencies
WORKDIR /home/node/app/bin
RUN npm install --omit=dev

WORKDIR /home/node/app/bin/projects/server

ENTRYPOINT ["node", "./src/index.js"]