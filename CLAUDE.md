# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `npm run dev` - Start development server with hot reload
- `npm run dev -- --open` - Start dev server and open browser

### Building & Production

- `npm run build` - Create production build
- `npm run preview` - Preview production build locally

### Code Quality

- `npm run lint` - Run ESLint and Prettier checks
- `npm run format` - Format code with Prettier
- `npm run check` - Run SvelteKit sync and type checking
- `npm run check:watch` - Run type checking in watch mode

### Testing

- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:ui` - Open Vitest UI (requires `npm install -D @vitest/ui`)
- `npm run test:coverage` - Run tests with coverage report (requires `npm install -D @vitest/coverage-v8`)

## Architecture

### Core Technology Stack

- **SvelteKit** with TypeScript and Vite
- **Firebase** for authentication and Firestore database
- **TailwindCSS** with DaisyUI for styling
- **Lucide icons** for UI elements

### Data Model

This is a task management application with a graph-based data structure:

- **Tasks**: Core entities with name, completion status, and timestamps
- **Tags**: Categories that organize tasks
- **Junctions**: Relationships between tasks and tags (many-to-many)

All data is stored per-user in Firestore collections: `users/{uid}/nodes` and `users/{uid}/junctions`.

### Global State Management

- `src/lib/globalState.svelte.ts` - Firebase integration, authentication state, and data converters
- Uses Svelte 5 runes (`$state`, `$derived`) for reactivity
- Firebase collections are user-scoped and reactive to auth state changes

### Key Files

- `src/app.d.ts` - Global TypeScript types for Task, Tag, GraphNode, and Junction
- `src/lib/database.ts` - Database operations (addTask, updateTask, getTasksInTag, etc.)
- `src/routes/+layout.svelte` - Main app layout with Header component
- `firebase.json` - Firebase hosting configuration for SPA deployment

### Routing Structure

- `/` - Main page
- `/tasks` - Task management interface
- `/tag/[slug]` - View tasks for specific tag
- `/tag/[slug]/edit` - Edit tag interface
- `/about` - About page

### Firebase Configuration

Environment variables required:

- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_STORAGE_BUCKET`
- `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `PUBLIC_FIREBASE_APP_ID`

### Development Notes

- SSR is disabled (`export const ssr = false` in +layout.svelte)
- Uses Firebase persistent local cache with tab synchronization
- Task input supports inline tags with `#` syntax
- Static site generation configured for Firebase hosting
- **Svelte 5 Reactivity**: Use `$derived.by()` for complex derived values that require function logic, not just `$derived()`
