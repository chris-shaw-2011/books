FROM node:23-slim

# Setup working directory
WORKDIR /home/node/app

# Download and extract the app
RUN wget -qO- https://github.com/chris-shaw-2011/books/releases/latest/download/transpiled.tar.gz \
	| tar xvz --strip-components=1

# Install production dependencies
WORKDIR /home/node/app/bin
RUN npm install --omit=dev

WORKDIR /home/node/app/bin/projects/server

ENTRYPOINT ["npm", "run", "start-production"]