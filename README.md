# TiKit Backend

REST API for the TiKit school event ticketing platform. Built with NestJS, PostgreSQL (PostGIS), and Prisma.

---

## Requirements

- Node.js 20+
- PostgreSQL 16+ with PostGIS extension (or use the provided Docker Compose)
- npm

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the database

```bash
docker-compose up -d
```

This starts a PostgreSQL 16 + PostGIS instance on port `5432`.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values. At minimum you need:
- `DATABASE_URL` and `DIRECT_URL`
- `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` (RS256 key pair — see instructions in `.env.example`)

### 4. Run database migrations

```bash
npx prisma migrate dev
```

### 5. (Optional) Seed the database

```bash
npx ts-node scripts/mega-seed.ts
```

### 6. Start the development server

```bash
npm run start:dev
```

API is available at `http://localhost:3000/v1`
Swagger docs at `http://localhost:3000/v1/docs`
Health check at `http://localhost:3000/v1/health`

---

## Environment Variables

See [.env.example](.env.example) for all variables with descriptions. Key ones:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (can be pooled) |
| `DIRECT_URL` | Yes | Direct PostgreSQL connection (used by migrations) |
| `JWT_PRIVATE_KEY` | Yes | RS256 private key for signing tokens |
| `JWT_PUBLIC_KEY` | Yes | RS256 public key for verifying tokens |
| `CORS_ORIGIN` | Prod only | Allowed frontend origins (comma-separated) |
| `FRONTEND_URL` | Prod only | Used in password reset email links |
| `LOG_LEVEL` | No | `debug` (dev default) / `warn` (prod default) |
| `RESEND_API_KEY` | No | Email sending — falls back to console log in dev |
| `ELKS_USERNAME` | No | SMS via 46elks — falls back to mock in dev |
| `AWS_ACCESS_KEY_ID` | No | S3 file uploads |

---

## Scripts

```bash
npm run start:dev     # Development with hot reload
npm run start:prod    # Production (runs compiled dist/)
npm run build         # Compile TypeScript
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:cov      # Test coverage report
npm run lint          # ESLint
npm run format        # Prettier
```

---

## Database

```bash
npx prisma migrate dev          # Run pending migrations (dev)
npx prisma migrate deploy       # Run pending migrations (production)
npx prisma studio               # Open Prisma Studio (DB GUI)
npx prisma generate             # Regenerate Prisma client after schema changes
```

---

## Project Structure

```
src/
├── auth/           # JWT auth, guards, decorators, OTP, password reset
├── users/          # User profiles, follow system, notification settings
├── schools/        # School management
├── events/         # Event CRUD, ticket types, social features
├── tickets/        # Ticket purchase and QR code generation
├── scanner/        # QR code scanning and check-in
├── cards/          # Digital loyalty cards
├── wallet/         # User wallet (tickets + activated cards)
├── vouchers/       # Voucher redemption
├── campaigns/      # Push/email/SMS campaign management
├── segments/       # User segmentation for campaigns
├── posts/          # School social feed
├── classes/        # School class management
├── notifications/  # Push notification delivery
├── upload/         # S3 presigned URL generation
├── gateway/        # WebSocket gateway (real-time events)
├── admin/          # Admin dashboard statistics
├── emails/         # Transactional email service (Resend)
├── config/         # Config factories and env validation
├── common/         # Shared filters, enums, decorators
└── prisma/         # Prisma service and module
```

---

## API Overview

All routes are prefixed with `/v1`. All routes require a Bearer JWT unless marked public.

| Module | Base path |
|---|---|
| Auth | `/v1/auth` |
| Users | `/v1/users` |
| Schools | `/v1/schools` |
| Events | `/v1/events` |
| Tickets | `/v1/tickets` |
| Cards | `/v1/cards` |
| Wallet | `/v1/wallet` |
| Vouchers | `/v1/vouchers` |
| Scanner | `/v1/scanner` |
| Campaigns | `/v1/campaigns` |
| Upload | `/v1/upload` |
| Admin | `/v1/admin` |
| Health | `/v1/health` |

Full interactive documentation is available via Swagger at `/v1/docs` (development only).

---

## Deployment

Set `NODE_ENV=production` and ensure all required env vars are present. Run migrations before starting:

```bash
npx prisma migrate deploy
node dist/main
```

The health endpoint at `/v1/health` performs a live database ping and returns HTTP 503 if the database is unreachable — use this for load balancer health checks.
