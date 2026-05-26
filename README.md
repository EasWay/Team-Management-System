# AlphaGroupOfDevelopers Digital HQ

**Team Management System v2.0** - A virtual office environment where the Alpha Group of Developers team collaborates, builds, and ships businesses.

## 🏢 The Digital HQ Concept

This platform transforms traditional project management into a **Virtual Office** experience. Every team member has their own private office where they work on "folders" (projects/tasks) that move sequentially through the team's workflow.

### Key Spaces

- **🏢 Private Offices** - Each team member has a numbered office (e.g., Office #202) with a desk and inbox
- **🎨 Idea Lab** - Where new business ideas are born and structured by AI
- **🏛️ Conference Room** - The decision table where folders are reviewed and approved
- **📊 QA Office** - Final quality assurance station before launch

### The Workflow

1. **Idea Lab** → AI Transcriptionist processes brainstorming sessions
2. **Lead Researcher's Office** → Initial research and scoping
3. **Systems Architect's Office** → Backend structure planning
4. **Backend Engineer's Office** → Core implementation
5. **Full Stack Engineer's Office** → Frontend integration
6. **AI Engineer's Office** → Intelligent features
7. **QA Tester's Office** → Quality assurance
8. **Conference Room** → Final approval
9. **🚀 Launch!**

## 👥 Alpha Group of Developers Team

| Office | Role | Team Member |
|--------|------|-------------|
| #100 | Project Manager | Abena Ntewusu Exceltrine |
| #101 | Lead Researcher | George Essel Bonsu |
| #201 | Systems Architect | Daniel Mensah |
| #202 | Backend Engineer | Kingsley Okyere (Founder) |
| #203 | Full Stack Engineer | Godfred Fokuo (Co-founder) |
| #301 | AI Engineer | Godsway Ganyo |
| #302 | QA Tester | (Open Position) |
| #303 | Designer | (Open Position) |

## ✨ Features

## ✨ Features

### Core Collaboration
- **Virtual Offices** - Private workspaces with desk/inbox metaphor
- **Sequential Handoff** - Folders move through offices in controlled order
- **Conference Room** - Approval workflows (Boss/PM/Team Vote)
- **Real-time Updates** - Live status indicators via Socket.io

### AI-Powered Tools
- **Idea Lab** - AI Transcriptionist processes chat logs and identifies speakers
- **QA Office** - Comprehensive quality inspection with scoring
- **Smart Evaluation** - Design, business, and technical alignment analysis

### Traditional Features
- **Team Management** - Create teams, invite members, manage roles
- **Task Tracking** - Kanban boards with drag-and-drop
- **GitHub Integration** - Link repositories, sync PRs, track issues
- **Project Management** - Organize work with files and deliverables
- **Client Management** - Track clients and their projects
- **Messaging** - In-app team communication

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

## 🚀 Getting Started

```bash
# Clone repository
git clone https://github.com/EasWay/Team-Management-System.git
cd Team-Management-System/team-manager

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials:
# - DATABASE_URL (PostgreSQL)
# - GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET
# - GROQ_API_KEY (for AI features)
# - JWT_SECRET & ENCRYPTION_KEY

# Push database schema
pnpm db:push

# (Optional) Setup test data
npx tsx setup-test-data.ts

# Start development server
pnpm dev
```

The Digital HQ will be available at `http://localhost:5000`

### 🧪 Testing the Workflow

> **📖 For complete testing instructions, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)**

Quick test:
1. Login with GitHub
2. Create a team or select existing team
3. Invite team members and assign office roles
4. Go to Conference Room → Idea Lab
5. Paste a brainstorming chat and activate project
6. Watch it flow through offices!

**Production URL:** https://team-management-system-zq6x.onrender.com

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (frontend + backend) |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm db:push` | Push database schema changes |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm test` | Run tests |
| `pnpm check` | TypeScript type checking |

## 🚢 Deployment

- **Platform**: [Render](https://render.com) with auto-deploy on push to `main`
- **Database**: [Neon](https://neon.tech) (serverless PostgreSQL)
- **Storage**: AWS S3 for file uploads

## 📄 License

MIT

## 👨‍💻 Authors

**Alpha Group of Developers (Alphadeps)**

- **Kingsley Okyere** - Founder & Backend Engineer
- **Godfred Fokuo** - Co-founder & Full Stack Engineer - [GitHub](https://github.com/EasWay) | [LinkedIn](https://linkedin.com/in/resilience-fred)
- **George Essel Bonsu** - Lead Researcher
- **Daniel Mensah** - Lead Systems Architect
- **Godsway Ganyo** - AI Engineer
- **Abena Ntewusu Exceltrine** - Project Manager

---

**Built with ❤️ by Alpha Group of Developers | 2026**

## 🏗️ Project Structure

```
team-manager/
├── client/              # React frontend (The Digital HQ UI)
│   └── src/
│       ├── pages/       # Virtual office views
│       │   ├── Workspace.tsx      # "My Office" (Desk & Inbox)
│       │   ├── DecisionTable.tsx  # "Conference Room"
│       │   ├── Evaluation.tsx     # "QA Office"
│       │   └── ...
│       ├── components/  # UI components
│       │   ├── IdeationPanel.tsx  # "Idea Lab"
│       │   ├── EvaluationDashboard.tsx
│       │   └── ...
│       ├── contexts/    # React contexts
│       └── hooks/       # Custom hooks
├── server/              # Express backend
│   ├── _core/           # Core utilities
│   │   ├── ideationEngine.ts    # AI speaker identification
│   │   ├── projectEvaluator.ts  # Quality inspection AI
│   │   ├── auth.ts
│   │   └── trpc.ts
│   └── *.ts             # Route handlers and services
├── shared/              # Shared types and utilities
└── drizzle/             # Database schema
    └── schema.ts        # Includes approvals, handoff tracking
```

## 📝 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-app.com/api/oauth/github/callback

# Security
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_32_char_encryption_key

# AI Features (Groq API)
GROQ_API_KEY=your_groq_api_key

# Optional: AWS S3 for file storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_S3_BUCKET=...
```

## 🎯 How to Use the Digital HQ

> **📖 For complete workflow documentation, see [UNIFIED_WORKFLOW.md](./UNIFIED_WORKFLOW.md)**
> 
> This guide explains how ALL features (traditional + new) work together.

### Quick Start Guide

#### **Starting a New Project**

1. **Idea Lab** - Paste your WhatsApp brainstorming chat
2. AI extracts speakers and creates a Final Decision Report
3. Click "Activate Project" to deliver to Lead Researcher (George)

#### **Working on a Folder**

1. Check your **Inbox** for new folders delivered to you
2. Move folder to your **Desk** to start working
3. Add deliverables (Figma links, GitHub PRs, documents)
4. Click **"Deliver Folder"** to send to next office

#### **Approving Work**

1. Go to **Conference Room** to see pending folders
2. Review deliverables and handoff notes
3. Approve (moves to next office) or Reject (returns to sender)

#### **Quality Assurance**

1. **QA Office** shows all completed folders
2. Run AI inspection to get quality scores
3. Folders scoring 90+ are cleared for launch

### Feature Integration

The Digital HQ seamlessly combines:
- **Traditional Features**: Tasks (Kanban), Projects, Repositories, Team Members, Messages
- **Office Features**: My Office (Desk + Inbox), Office Directory, Access Control
- **AI Features**: Idea Lab (Brainstorming), QA Office (Quality Inspection)
- **Approval System**: Conference Room with Boss/PM/Team Vote modes

All features work together - tasks from the Kanban board appear in offices, GitHub repos link to deliverables, and messages keep everyone connected.

## 🛠️ Development Scripts
