
# Books Monorepo

## Overview

This application is an audiobook management platform. It allows users to organize, track, and convert audiobooks, manage user accounts, and interact with their audiobook library through a modern web interface. The backend provides APIs for book management, conversion, and user authentication, while the frontend offers a responsive UI for browsing and managing books.

## Features

- Manage a library of audiobooks (add, edit, delete)
- Track read/unread status and metadata for each book
- Upload and convert audiobook files (e.g., zip of mp3s to m4b)
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
- Node.js >= 24.0.2
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

### Docker

To run the server in Docker:

```sh
docker compose up -d
```

## Scripts

- `npm start` - Start client and server in development
- `npm run build` - Build all packages for production
- `npm run lint` - Run lint checks
- `npm run analyze` - Analyze client bundle size

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
