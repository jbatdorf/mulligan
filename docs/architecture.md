# Initial Architecture
*Created 2025-06-01*

## Mobile
| Choice | Rationale |
|---|---|
| **React Native + Expo** | Cross-platform iOS/Android, large talent pool, Expo OTA updates |


## Web
| Choice | Rationale |
|---|---|
| **Next.js** | Marketing site + web app, shares component logic with mobile via React Native Web |

## API
| Choice | Rationale |
|---|---|
| **Fastify + TypeScript** | Fast, lightweight, outperforms Express at scale |
| **tRPC** | End-to-end type safety over REST; no schema language or codegen — types flow directly from server to client, GraphQL is enhancement|

## Database
| Choice | Rationale |
|---|---|
| **PostgreSQL + PostGIS** | Primary store for users, restaurants, rankings; PostGIS for geo queries |
| **Redis** | Caching hot feeds, trending restaurants, session tokens |

## Search
| Choice | Rationale |
|---|---|
| **Algolia or Typesense** | Full-text + geo search; non-trivial to build well in Postgres alone |

## Infrastructure
| Choice | Rationale |
|---|---|
| **S3 / Cloudflare R2** | Image storage (food photos, avatars) |
| **Cloudflare Images / imgix** | On-the-fly resizing |
| **BullMQ** | Background jobs — feed generation, push notifications, recommendation refreshes |

## Auth & Notifications
| Choice | Rationale |
|---|---|
| **Clerk or Auth0** | Phone/email + social login; no reinventing auth |
| **Expo Push / APNs / FCM** | Push notifications via BullMQ worker |

## Recommendations
| Choice | Rationale |
|---|---|
| **Python + FastAPI** | Decoupled microservice; collaborative filtering via scikit-learn or LightFM |

## DevOps
| Choice | Rationale |
|---|---|
| **Railway / Render** (early) → **AWS ECS + RDS** (scale) | Low ops overhead early; full control at scale |
| **GitHub Actions + Turborepo** | CI/CD with affected-package diffing |
| **Sentry + PostHog** | Error tracking + product analytics |

---

## Monorepo Structure

```
mulligan/
├── apps/
│   ├── mobile/               # React Native + Expo
│   ├── web/                  # Next.js
│   └── api/                  # Fastify + tRPC
├── packages/
│   ├── ui/                   # Shared component library
│   ├── schemas/              # Zod validation schemas (shared across api + mobile + web)
│   ├── db/                   # Prisma schema, migrations, client
│   ├── config/               # Shared tsconfig, eslint, prettier
│   └── utils/                # Shared business logic
├── services/
│   ├── recommendations/      # Python FastAPI microservice
│   ├── notifications/        # Push notification worker
│   └── search-indexer/       # Algolia sync worker
├── infra/                    # Terraform / CDK
└── turbo.json
```

## Package Dependency Rules

```
mobile / web  →  @mulligan/schemas   ✅
mobile / web  →  @mulligan/db        ❌  never
api           →  @mulligan/schemas   ✅
api           →  @mulligan/db        ✅
```

## Schema Boundaries

| Package | Contents | Consumers |
|---|---|---|
| `packages/db` | Prisma models + migrations | `apps/api` only |
| `packages/schemas` | Zod validation schemas + inferred types | `apps/api`, `apps/mobile`, `apps/web` |

> **Rule:** Prisma types never leak into the UI. An explicit mapper layer in `apps/api` translates DB types → tRPC response types, keeping the boundary compiler-enforced.