# Team Management System

A full-stack team management platform with real-time collaboration, task tracking, and GitHub integration.

## Features

- **Team Management** -- Create teams, invite members, manage roles
- **Task Tracking** -- Kanban boards with drag-and-drop, task history
- **Real-time Collaboration** -- Live updates via Socket.io
- **GitHub Integration** -- Link repositories, sync PRs, track issues
- **Project Management** -- Organize work into projects with files
- **Client Management** -- Track clients and their projects
- **Messaging** -- In-app team messaging
- **OAuth Authentication** -- Sign in with GitHub

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS, Radix UI |
| Backend | Express, tRPC, Socket.io |
| Database | PostgreSQL, Drizzle ORM |
| Auth | GitHub OAuth, JWT |
| Real-time | Socket.io, Yjs (collaborative editing) |
| Storage | AWS S3 |
| AI | Groq API |

## Getting Started

```bash
# Install dependencies
cd team-manager
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, GitHub OAuth credentials, etc.

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm db:push` | Run database migrations |
| `pnpm test` | Run tests |
| `pnpm check` | Type check |

## Project Structure

```
team-manager/
├── client/          # React frontend
│   └── src/
│       ├── pages/   # Route pages
│       ├── components/  # UI components
│       ├── contexts/    # React contexts
│       └── hooks/       # Custom hooks
├── server/          # Express backend
│   ├── _core/       # Core utilities (auth, trpc, env)
│   └── *.ts         # Route handlers and services
├── shared/          # Shared types and utilities
└── drizzle/         # Database schema and migrations
```

## Environment Variables

```env
DATABASE_URL=postgresql://...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://your-app.com/api/oauth/github/callback
JWT_SECRET=...
ENCRYPTION_KEY=...
GROQ_API_KEY=...
```

## Deployment

Deployed on [Render](https://render.com) with auto-deploy on push to `main`.

Database hosted on [Neon](https://neon.tech) (serverless PostgreSQL).

## License

MIT

## Author

**Godfred Fokuo** -- [GitHub](https://github.com/EasWay) | [LinkedIn](https://linkedin.com/in/resilience-fred)
