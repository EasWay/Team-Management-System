# Collaborative Development Platform Dependencies

This document lists the new dependencies installed for the collaborative development platform features.

## Real-time Communication
- **socket.io** (^4.8.3) - Server-side WebSocket library for real-time bidirectional communication
- **socket.io-client** (^4.8.3) - Client-side Socket.io library
- **@socket.io/redis-adapter** (^8.3.0) - Redis adapter for Socket.io horizontal scaling

## Collaborative Editing
- **yjs** (^13.6.29) - CRDT framework for conflict-free collaborative editing
- **y-websocket** (^3.0.0) - WebSocket provider for Yjs synchronization

## Code Editor
- **monaco-editor** (^0.55.1) - VS Code's editor component
- **@monaco-editor/react** (^4.7.0) - React wrapper for Monaco Editor

## GitHub Integration
- **@octokit/rest** (^22.0.1) - GitHub REST API client
- **@octokit/webhooks** (^14.2.0) - GitHub webhook event handling

## Caching and Scaling
- **ioredis** (^5.9.2) - Redis client for Node.js

## Development Dependencies
- **@types/socket.io** (^3.0.1) - TypeScript definitions for Socket.io
- **@types/ioredis** (^4.28.10) - TypeScript definitions for ioredis

## TypeScript Configuration Updates
- Added `socket.io` and `ioredis` to the types array
- Changed JSX mode from `preserve` to `react-jsx` for better React 19 compatibility
- Maintained `skipLibCheck: true` to avoid type definition conflicts in dependencies

## Installation Notes
- All packages were installed using `npm install --legacy-peer-deps` due to peer dependency conflicts with vite plugins
- The project uses npm for package management despite having pnpm configuration
- 16 moderate severity vulnerabilities exist in the dependency tree (inherited from existing dependencies)

## Next Steps
These dependencies enable the following features:
1. Real-time task board synchronization (Socket.io)
2. Collaborative code editing (Yjs + Monaco Editor)
3. GitHub repository integration (Octokit)
4. Scalable real-time infrastructure (Redis + Socket.io adapter)
