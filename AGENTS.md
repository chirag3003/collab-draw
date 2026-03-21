# AGENTS.md - Collab Draw

Real-time collaborative drawing app. Bun/Next.js monorepo frontend + Go/GraphQL backend.

## Repository Structure

```
collab-draw/
  packages/
    web/     # Next.js 15 frontend (React 19, Tailwind v4, Apollo Client)
    api/     # Go GraphQL API (gqlgen, MongoDB, Keycloak OIDC)
  infra/     # Keycloak realm config
  docker-compose.yaml
```

## Build & Run Commands

### Frontend (`packages/web`)

```sh
bun install                    # Install dependencies (from repo root)
bun run dev                    # Dev server with Turbopack on port 3080
bun run build                  # Production build (next build --turbopack)
bun run lint                   # Lint with Biome (biome check)
bun run format                 # Format with Biome (biome format --write)
bunx biome check --fix         # Auto-fix lint issues
```

### Backend (`packages/api`)

```sh
go run server.go               # Run API server (default port 8080, PORT env)
go build -o server .           # Build binary
go generate ./...              # Regenerate gqlgen code after schema changes
```

### Docker (Full Stack)

```sh
docker compose up              # Start all services (mongo, keycloak, api, web)
docker compose up -d           # Detached mode
docker compose watch           # Dev mode with file sync/hot reload
```

### Testing

No tests exist yet. When adding tests:

- **Frontend**: Use `bun test` with `import { test, expect } from "bun:test"`
- **Backend**: Use `go test ./...` with standard Go testing
- **Single test (frontend)**: `bun test path/to/file.test.ts`
- **Single test (backend)**: `go test ./internal/repository/ -run TestName`

## Runtime & Tooling Rules

**Always use Bun, never Node.js/npm/pnpm/vite.** This applies to all TS/JS work:

- `bun <file>` not `node <file>`
- `bun install` not `npm install`
- `bun run <script>` not `npm run <script>`
- `bunx <pkg>` not `npx <pkg>`
- `bun test` not `jest` or `vitest`
- Bun auto-loads `.env` -- do not use `dotenv`

## Code Style - Frontend (TypeScript/React)

### Formatting (Biome)

- **Indent**: 2 spaces
- **Quotes**: double quotes for strings
- **Semicolons**: required
- **Imports**: auto-organized by Biome (`organizeImports: "on"`)
- Run `bun run lint` before committing

### TypeScript

- Strict mode enabled (`strict: true` in tsconfig)
- `noUncheckedIndexedAccess: true` -- indexed access returns `T | undefined`
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`
- Use `type` imports: `import type { Foo } from "bar"`
- Path alias: `@/*` maps to project root (e.g., `@/components/ui/button`)

### React / Next.js Patterns

- **App Router** (Next.js 15): pages in `app/`, not `pages/`
- Client components: add `"use client"` directive at top of file
- Server components are the default -- prefer them when possible
- Async server components: `export default async function Page() {}`
- Use `React.ReactNode` for children types
- Layouts in `layout.tsx`, pages in `page.tsx`

### Component Organization

```
components/
  ui/           # Reusable shadcn/ui primitives (Button, Card, Dialog, etc.)
  app/          # App-specific composite components
  projects/     # Project/drawing-specific components
  providers/    # Context providers (Apollo, Auth)
```

- UI primitives use `cn()` utility from `@/lib/utils` for class merging
- Use `class-variance-authority` (cva) for component variants
- Icons from `lucide-react`

### Hooks & Data Fetching

- Custom hooks in `lib/hooks/` (e.g., `useProjectByID`, `useCreateProject`)
- GraphQL via Apollo Client (`@apollo/client`)
- Queries defined inline with `gql` template literals inside hooks
- Return types explicitly typed inline with generics on `useQuery<T>`, `useMutation<T>`
- Use `"network-only"` fetch policy for data that must be fresh

### Auth

- Keycloak OIDC via custom auth module in `lib/auth/`
- `useAuth()` hook provides `user`, `accessToken`, `status`, `signOut`
- Session cookie: `collab-session`
- Middleware in `middleware.ts` protects `/app`, `/projects`, `/api/graphql`

### Styling

- Tailwind CSS v4 with `tw-animate-css`
- shadcn/ui design tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, etc.
- `tailwind-merge` via `cn()` for conditional/merged classes

## Code Style - Backend (Go)

### Project Structure

```
packages/api/
  server.go              # Entrypoint, HTTP server setup
  graph/
    *.graphqls            # GraphQL schema files
    generated.go          # Auto-generated -- DO NOT EDIT
    model/models_gen.go   # Auto-generated models -- DO NOT EDIT
    resolvers/            # Resolver implementations (edit these)
  internal/
    auth/                 # Auth middleware, context helpers
    config/               # Constants
    db/                   # MongoDB connection
    models/               # Domain models (bson-tagged structs)
    oidc/                 # OIDC token verification
    repository/           # Data access layer (interfaces + implementations)
```

### Go Conventions

- Module: `github.com/chirag3003/collab-draw-backend`
- Standard Go formatting (`gofmt`/`goimports`)
- Repository pattern: interfaces define data access, concrete structs implement them
- Error handling: return `(result, error)` tuples; wrap with `fmt.Errorf("context: %v", err)`
- Auth: extract user from context via `auth.ForContext(ctx)` -- returns OIDC claims
- MongoDB IDs: use `bson.ObjectID`, convert with `bson.ObjectIDFromHex()`
- Struct tags: `bson:"field_name"` + `json:"fieldName"`

### GraphQL Schema Changes

1. Edit `.graphqls` files in `graph/`
2. Run `go generate ./...` (or `go run github.com/99designs/gqlgen generate`)
3. Implement new resolvers in `graph/resolvers/` -- generated stubs go there
4. Never edit `graph/generated.go` or `graph/model/models_gen.go` by hand

### Resolver Pattern

- Auth check at start: `authContext := auth.ForContext(ctx)`
- Delegate to repository: `r.Repo.Project.Method(ctx, ...)`
- Convert internal models to GraphQL models before returning
- Errors: `return nil, fmt.Errorf("failed to <action>: %v", err)`

## Infrastructure

- **MongoDB**: primary database (port 27017)
- **Keycloak**: OIDC identity provider (port 8080), realm `collab-draw`
- **PostgreSQL**: Keycloak's backing database (port 5432)
- API proxied through Next.js at `/api/graphql`; WebSocket subscriptions connect directly to API

## Key Libraries

| Frontend                    | Backend                          |
| --------------------------- | -------------------------------- |
| Next.js 15 (App Router)     | gqlgen (GraphQL)                 |
| React 19                    | chi (HTTP router)                |
| Apollo Client 4             | gorilla/websocket                |
| Excalidraw                  | mongo-driver v2                  |
| Tailwind CSS v4 + shadcn/ui | coreos/go-oidc v3                |
| Zod (validation)            | godotenv                         |
| RxJS (OT engine)            | rs/cors                          |
| react-hook-form             |                                  |
