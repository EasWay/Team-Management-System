# Team Manager — Mobile App

Native iOS & Android app built with **Expo** + **React Native**, connecting to the same backend as the web app.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo (SDK 51) + React Native 0.74 |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind (Tailwind CSS for RN) |
| API | tRPC client + React Query |
| Real-time | Socket.io client |
| Auth | GitHub OAuth via expo-web-browser |
| State | Zustand |
| Push Notifications | expo-notifications (APNs + FCM) |
| Secure Storage | expo-secure-store |

## Features

- ✅ GitHub OAuth authentication (deep link flow)
- ✅ Email/password login & registration
- ✅ My Office — assigned tasks and projects dashboard
- ✅ Tasks — status-filtered Kanban with real-time Socket.io sync
- ✅ Projects — create, list, and AI Idea Lab (paste chat → AI extracts project)
- ✅ Teams — create teams, invite members, switch active team
- ✅ Files — upload from camera/library/documents, view, delete
- ✅ Calendar — monthly view, create/delete events
- ✅ Conference Room — approve/reject workflow decisions
- ✅ Analytics — sprint metrics and team performance
- ✅ Profile — notification preferences, quick nav, sign out
- ✅ Push Notifications — task assignments, approvals, mentions, deadlines

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+
- Expo Go app on your phone (for development)

### Install Dependencies

```bash
cd team-manager/mobile
npm install
```

### Environment

Create `team-manager/mobile/.env`:
```
EXPO_PUBLIC_API_BASE_URL=https://team-management-system-zq6x.onrender.com
EXPO_PUBLIC_WS_URL=wss://team-management-system-zq6x.onrender.com
```

### Run in Development

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone.

### Add Assets

See `assets/ASSETS_REQUIRED.md` for required image files.

### Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build
eas build --platform all --profile production
```

## Project Structure

```
mobile/
├── src/
│   ├── app/              Expo Router screens
│   │   ├── _layout.tsx   Root layout (providers)
│   │   ├── index.tsx     Entry redirect
│   │   ├── (auth)/       Login screen
│   │   └── (app)/        Authenticated tabs
│   │       ├── _layout.tsx  Tab navigator
│   │       ├── index.tsx    My Office
│   │       ├── tasks/       Task management
│   │       ├── projects/    Projects + AI Idea Lab
│   │       ├── teams/       Team management
│   │       ├── files/       File upload & management
│   │       ├── calendar/    Calendar & events
│   │       ├── conference/  Approval workflow
│   │       ├── analytics/   Team metrics
│   │       └── profile/     User settings
│   ├── components/       Reusable UI components
│   ├── hooks/            Custom hooks
│   ├── lib/              API client, socket, notifications
│   └── store/            Zustand state stores
├── assets/               App icons and images
├── app.json              Expo configuration
├── eas.json              EAS Build configuration
├── babel.config.js       Babel + NativeWind
├── metro.config.js       Metro + NativeWind
├── tailwind.config.js    Tailwind configuration
└── tsconfig.json         TypeScript configuration
```

## Backend Integration

The mobile app connects to the **existing** Team Manager backend with no changes required (except the new mobile OAuth endpoint and push token registration).

- **tRPC**: All API calls via `@trpc/react-query` — types shared from `../server/routers.ts`
- **Socket.io**: Real-time task/project updates
- **S3**: File uploads via `/api/upload` REST endpoint

## Push Notifications

On first launch, the app requests push notification permission and registers the Expo push token with the backend via `trpc.notifications.registerPushToken`.

The backend can send push notifications to mobile users by calling the Expo Push API using the stored token when events occur (task assignments, approvals, mentions, etc.).

## Backend Changes Added

1. **`server/oauth-callbacks.ts`** — Added `handleGitHubMobileCallback` that redirects to `team-management://oauth-callback` deep link
2. **`server/_core/oauth.ts`** — Routes mobile OAuth via `?mobile=true` param  
3. **`drizzle/schema.ts`** — Added `user_push_tokens` table
4. **`server/routers.ts`** — Added `notifications.registerPushToken` procedure + made `projects.create.clientId` optional
