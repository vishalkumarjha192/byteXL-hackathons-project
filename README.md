# Creatorly — AI Content Creator Marketplace

> A full-stack marketplace that connects brands with AI content creators for UGC, product ads, AI avatars, voiceovers, social content, and visual campaigns.

Creatorly helps brands discover creators, publish projects, review applications, manage production, communicate in real time, handle project payments, and leave reviews — while giving creators profiles, portfolios, recommendations, project workspaces, earnings, and payouts.

---

## ✨ Highlights

- **Creator marketplace** with search, filters, portfolios, ratings, verification, and featured creators
- **Brand project management** for briefs, budgets, deadlines, applications, hiring, deliverables, revisions, and completion
- **AI-assisted workflows**
  - AI-generated creative briefs
  - Rule-based creator/project matching
  - Recommended projects for creators
  - Optional Anthropic integration
- **Secure authentication** with JWT access/refresh tokens and Argon2 password hashing
- **Role-based access control** for `BRAND`, `CREATOR`, and `ADMIN`
- **Project workspace** with deliverables, revisions, chat, reviews, and payment status
- **Payments abstraction** with a development-safe mock provider and an extension point for Stripe/Razorpay
- **File uploads** with type/size validation, public/private access, and signed links for private files
- **Notifications and email** with console and SMTP backends
- **Admin dashboard** for moderation, verification, reports, categories, payments, users, and audit logs
- **WebSocket project chat** with polling fallback
- **PostgreSQL + SQLAlchemy + Alembic**
- **Frontend and backend test suites**

---

## 🧱 Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 | UI |
| TypeScript | Type safety |
| Vite | Development/build tooling |
| React Router | Routing |
| TanStack Query | Server state/data fetching |
| React Hook Form | Forms |
| Zod | Validation |
| Tailwind CSS | Styling |
| Vitest + Testing Library | Frontend tests |

### Backend

| Technology | Purpose |
|---|---|
| FastAPI | REST API |
| Python | Backend language |
| SQLAlchemy | ORM |
| PostgreSQL | Database |
| Alembic | Database migrations |
| Pydantic | Validation/settings |
| JWT | Authentication |
| Argon2 | Password hashing |
| Boto3 | S3-compatible storage |
| WebSockets | Real-time messaging |
| Pytest | Backend tests |

### Infrastructure

- Docker
- Docker Compose
- PostgreSQL 16
- Local file storage or S3-compatible object storage

---

## 🗂️ Project Structure

```text
ai-creator-marketplace/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── admin/
│   │   │   ├── ai/
│   │   │   ├── auth/
│   │   │   ├── comms/
│   │   │   ├── creators/
│   │   │   ├── jobs/
│   │   │   ├── payments/
│   │   │   ├── projects/
│   │   │   └── reviews/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── dependencies/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

For the Docker workflow, install:

- Docker
- Docker Compose

For local development without Docker:

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

---

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd ai-creator-marketplace
```

### 2. Configure environment variables

Create your local environment file:

```bash
cp .env.example .env
```

At minimum, set a strong JWT secret:

```env
JWT_SECRET=replace-with-a-long-random-string
```

For local development, the default configuration uses:

- PostgreSQL
- local file storage
- mock payments
- console email
- template-based AI briefs
- rule-based creator matching

This means the application can run without external payment, email, or AI credentials.

### 3. Start the application

```bash
docker compose up --build
```

The services will be available at:

- **Frontend:** `http://localhost:5173`
- **API:** `http://localhost:8000`
- **Swagger/OpenAPI:** `http://localhost:8000/docs`
- **Health check:** `http://localhost:8000/health`

Database migrations run automatically when the backend starts.

---

## 🌱 Demo Data

Load demo data with:

```bash
docker compose exec backend python -m app.seed
```

The seed creates sample:

- brands
- creators
- projects
- portfolio items
- applications
- completed projects
- chat history
- reviews

Demo accounts use:

```text
Password: password123
```

Examples:

```text
brand1@example.com
creator1@example.com
admin@example.com
```

> Do not use the demo credentials in a shared or production environment.

---

## 👑 Admin Account

Admins cannot register through the normal registration flow.

Create an admin from the backend:

```bash
docker compose exec backend python -m app.create_admin --email admin@yourcompany.com
```

You will be prompted for a password.

---

## 💻 Local Development Without Docker

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite development server proxies API requests to the backend.

To use a different API URL:

```env
VITE_API_URL=http://localhost:8000
```

### Backend

Create and activate a virtual environment:

```bash
cd backend

python -m venv .venv
```

Linux/macOS:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload --port 8000
```

Make sure PostgreSQL is running and `DATABASE_URL` points to the correct database.

---

## 🧪 Testing

### Backend

```bash
cd backend
pip install -r requirements.txt
pytest
```

### Frontend

```bash
cd frontend
npm install
npm test
```

### Frontend production build

```bash
npm run build
```

The repository includes tests covering authentication, marketplace flows, projects/workspaces, communications, payments, files, AI, and admin functionality.

---

## 🔐 Authentication & Roles

Creatorly uses JWT-based authentication.

### Roles

#### `BRAND`

Brands can:

- create and manage projects
- search for creators
- review applications
- hire creators
- fund projects
- review deliverables
- request revisions
- approve/complete projects
- message hired creators
- leave reviews

#### `CREATOR`

Creators can:

- build a public profile
- manage skills, niches, languages, AI tools, and pricing
- upload portfolio items
- discover relevant projects
- apply to projects
- manage deliverables and revisions
- communicate with brands
- track earnings
- request withdrawals
- receive reviews

#### `ADMIN`

Admins can:

- view platform statistics
- manage users
- moderate creators and brands
- verify creators
- feature creators
- manage projects
- inspect payments
- resolve reports
- manage marketplace categories
- review audit logs

---

## 🤖 AI Features

### AI Brief Generator

Brands can submit a natural-language request and receive a structured content brief containing:

- title
- hook
- script
- scenes
- call-to-action
- deliverables
- suggested category
- content type
- platform

Without an API key, Creatorly uses a built-in template provider.

To enable Anthropic-generated briefs:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-api-key
AI_MODEL=claude-sonnet-5-5
```

Or use automatic provider selection:

```env
AI_PROVIDER=auto
ANTHROPIC_API_KEY=your-api-key
```

If an external AI request fails, the application falls back to the template provider instead of breaking the feature.

### Creator Matching

The default matching engine is deterministic and uses:

| Signal | Weight |
|---|---:|
| Skills | 30 |
| Language | 15 |
| Niche | 15 |
| Budget | 15 |
| Content type | 10 |
| Rating & experience | 10 |
| Keyword overlap | 5 |

A possible delivery-time conflict can also reduce the final score.

The matching implementation is isolated behind a strategy interface, allowing an LLM-based strategy to be added later.

Configure it with:

```env
MATCHING_STRATEGY=rules
```

---

## 💳 Payments

The payment system is intentionally provider-agnostic.

The current development provider is:

```env
PAYMENT_PROVIDER=mock
```

The mock provider performs no real financial transactions and is safe for local development and tests.

### Payment lifecycle

```text
Hiring
   ↓
PENDING
   ↓
Brand funds project
   ↓
HELD
   ↓
Project completed
   ↓
RELEASED
```

Cancellation of a funded project results in:

```text
HELD → REFUNDED
```

The platform commission is configurable:

```env
PLATFORM_FEE_PERCENT=20
```

For production payments, implement a real provider such as Stripe Connect or Razorpay Route behind the existing `PaymentProvider` interface.

> Real-money production use also requires provider onboarding, creator identity/bank verification, webhook handling, reconciliation, and compliance work.

---

## 📁 File Storage

Files can be stored locally or in an S3-compatible object store.

### Local storage

Leave this empty:

```env
S3_BUCKET=
```

Uploaded files are stored in the Docker `uploads` volume.

### S3-compatible storage

Configure:

```env
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_REGION=us-east-1
```

Supported file purposes include:

```text
AVATAR
LOGO
PORTFOLIO
DELIVERABLE
ATTACHMENT
ASSET
```

Public files can be served directly.

Private files use short-lived signed links and are only accessible to authorized users.

---

## 📧 Email

The default backend prints emails to the server log:

```env
EMAIL_BACKEND=console
```

For SMTP:

```env
EMAIL_BACKEND=smtp
EMAIL_FROM=Creatorly <no-reply@yourdomain.com>

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASSWORD=your-password
SMTP_TLS=true
```

Email delivery is used for supported notifications and password-reset workflows.

---

## 🔔 Notifications & Messaging

Creatorly includes:

- in-app notifications
- unread notification counts
- read-all/read-one actions
- project messaging
- WebSocket notifications for chat changes
- polling fallback when WebSockets disconnect

The current real-time implementation assumes a single backend process.

For multiple backend instances, introduce a shared broker such as Redis.

---

## 🛡️ Security

The application includes several security-oriented features:

- Argon2 password hashing
- JWT access and refresh tokens
- role-based route protection
- suspended-account checks
- request rate limiting for sensitive authentication flows
- file extension and file-signature validation
- file size limits
- private file authorization
- expiring signed file URLs
- validation through Pydantic schemas
- centralized API error responses
- admin audit logging

### Production checklist

Before production deployment:

- [ ] Replace `JWT_SECRET` with a strong random secret
- [ ] Use production PostgreSQL credentials
- [ ] Configure HTTPS
- [ ] Configure a real payment provider
- [ ] Configure SMTP or a transactional email provider
- [ ] Configure S3/object storage
- [ ] Add virus/malware scanning for uploaded files
- [ ] Add Redis for multi-instance rate limiting/realtime messaging
- [ ] Configure backups and database monitoring
- [ ] Remove demo accounts and seed data
- [ ] Review CORS and trusted origins
- [ ] Configure production logging and alerting
- [ ] Add browser/E2E testing
- [ ] Review privacy, payment, tax, and marketplace compliance requirements

---

## 🔌 API

The API is versioned under:

```text
/api/v1
```

Major resource groups include:

```text
/auth
/users
/creators
/brands
/projects
/applications
/deliverables
/revisions
/messages
/notifications
/reviews
/payments
/files
/ai
/admin
```

Interactive API documentation is available when the backend is running:

```text
http://localhost:8000/docs
```

The API uses consistent response shapes.

Successful responses generally follow:

```json
{
  "success": true,
  "data": {}
}
```

Errors follow:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

---

## 🧭 Main Frontend Routes

### Public

```text
/
 /creators
 /creators/:id
 /jobs
 /jobs/:id
 /how-it-works
 /pricing
 /about
 /login
 /register
 /forgot-password
 /reset-password
```

### Creator

```text
/dashboard/creator
/dashboard/creator/onboarding
/dashboard/creator/profile
```

### Brand

```text
/dashboard/brand
/dashboard/brand/profile
/dashboard/brand/projects/new
/dashboard/brand/projects/:id/applications
```

### Shared authenticated

```text
/projects/:id/workspace
/notifications
/dashboard/payments
```

### Admin

```text
/dashboard/admin
```

---

## 🔄 Typical Marketplace Workflow

```text
Brand
  │
  ├── Create project
  │
  ├── Generate AI brief (optional)
  │
  ├── Discover / match creators
  │
  ├── Review applications
  │
  └── Hire creator
          │
          ▼
      Fund project
          │
          ▼
     Project workspace
          │
          ├── Deliverable
          │
          ├── Revision request
          │
          ├── Final submission
          │
          └── Chat
          │
          ▼
       Approval
          │
          ▼
       Completion
          │
          ├── Release creator payment
          └── Leave review
```

---

## 🗄️ Database Migrations

Migrations are managed with Alembic.

Create a migration after changing SQLAlchemy models:

```bash
cd backend

alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Docker automatically runs:

```bash
alembic upgrade head
```

when the backend starts.

If you are upgrading an older local database created before migrations were introduced, reset the Docker volumes once:

```bash
docker compose down -v
docker compose up --build
```

> Back up any data before using `down -v` in an environment containing data you need to keep.

---

## ⚙️ Environment Variables

The main configuration options are:

```env
DATABASE_URL=
JWT_SECRET=
FRONTEND_URL=

PLATFORM_FEE_PERCENT=

# AI
AI_PROVIDER=
ANTHROPIC_API_KEY=
AI_MODEL=
MATCHING_STRATEGY=

# Payments
PAYMENT_PROVIDER=

# Storage
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=
S3_REGION=
PUBLIC_BASE_URL=

# Email
EMAIL_BACKEND=
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_TLS=
```

See `.env.example` for the complete development configuration.

---

## 🐳 Docker Services

`docker-compose.yml` defines three services:

```text
┌───────────────┐
│   Frontend    │
│ React + Vite  │
│    :5173      │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│    Backend    │
│ FastAPI/Uvicorn│
│    :8000      │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│  PostgreSQL   │
│     :5432     │
└───────────────┘
```

Persistent Docker volumes:

```text
pgdata   → PostgreSQL data
uploads  → Local uploaded files
```

---

## 🧩 Extending the Application

The project intentionally separates business logic from external providers.

### Add a payment provider

Implement `PaymentProvider` in:

```text
backend/app/services/payment_providers.py
```

Then register the provider and configure:

```env
PAYMENT_PROVIDER=your-provider
```

### Add an AI provider

Implement `AIProvider` in:

```text
backend/app/services/ai_providers.py
```

The brief-generation service can then select the provider without changing the marketplace workflow.

### Add a matching strategy

Matching logic is isolated in:

```text
backend/app/services/matching.py
```

This makes it possible to introduce an LLM or ML-based matcher while keeping the marketplace APIs stable.

---

## ⚠️ Current Limitations

This repository is a strong development/MVP foundation, but some production concerns remain:

1. **Payments**
   - Only the mock provider is included.
   - Real payment infrastructure requires provider integration, webhooks, creator onboarding, and compliance.

2. **Google OAuth**
   - The UI can expose the option, but Google OAuth credentials and backend OAuth flow still need to be configured.

3. **Multi-instance realtime**
   - WebSocket change notifications currently rely on in-process state.
   - A shared broker such as Redis is recommended for horizontal scaling.

4. **Rate limiting**
   - Current rate limiting is process-local.
   - Distributed deployments should use shared state.

5. **File lifecycle**
   - File cleanup, malware scanning, and advanced media delivery should be strengthened before production.

6. **Browser/E2E coverage**
   - Unit/component tests exist, but a production launch should add real-browser tests across critical workflows.

7. **Production infrastructure**
   - Monitoring, backups, secrets management, HTTPS, CDN/object storage, and deployment automation should be added for production.

---

## 🗺️ Roadmap

### Completed foundation

- [x] Authentication and authorization
- [x] Creator profiles and portfolios
- [x] Creator discovery/search
- [x] Brand projects
- [x] Applications and hiring
- [x] Project workflow
- [x] Deliverables and revisions
- [x] Reviews
- [x] Notifications
- [x] Project messaging
- [x] Payments abstraction
- [x] Creator earnings
- [x] File uploads
- [x] AI briefs
- [x] Creator matching
- [x] Admin dashboard
- [x] Moderation and reports
- [x] Verification
- [x] Audit logs
- [x] Password reset
- [x] Automated tests

### Suggested next steps

- [ ] Stripe Connect / Razorpay integration
- [ ] Google OAuth
- [ ] Redis-backed realtime and rate limiting
- [ ] Virus scanning for uploads
- [ ] Background jobs/queue
- [ ] Browser E2E tests
- [ ] Production observability
- [ ] CI/CD pipeline
- [ ] Creator payout onboarding
- [ ] Advanced analytics and marketplace metrics

---

## 🤝 Contributing

1. Create a feature branch:

```bash
git checkout -b feature/my-feature
```

2. Make your changes.

3. Run backend tests:

```bash
cd backend
pytest
```

4. Run frontend tests:

```bash
cd frontend
npm test
```

5. Build the frontend:

```bash
npm run build
```

6. Open a pull request with:
   - what changed
   - why it changed
   - how it was tested
   - any migration/configuration requirements

---

## 📄 License

Add the project's license here before publishing the repository.

Example:

```text
MIT License
```

---

## 👤 Author

**Vishal Kumar Jha**

Vishal Kumar Jha\
GitHub: https://github.com/vishalkumarjha192


---

## ⭐ Project Summary

**Creatorly is a full-stack AI creator marketplace designed to move a brand from idea → creator discovery → hiring → production → approval → payment → review in one workflow.**

Built with **React + TypeScript + FastAPI + PostgreSQL**, with modular AI, payment, storage, email, and matching providers so the platform can evolve from an MVP into a production marketplace.
