# AI Content Creator Marketplace

Status: all 7 phases are done, plus file uploads, live chat, email, password reset, wizards, an audit log and tests on both sides. See "Known gaps" at the bottom for what is still missing.

## Run it
1. `cp .env.example .env` and set `JWT_SECRET`
2. `docker compose up --build`
3. Open http://localhost:5173 (the app) and http://localhost:8000/docs (API docs)

## Load demo data
    docker compose exec backend python -m app.seed
Creates 10 brands (brand1@example.com ...), 30 creators (creator1@example.com ...), 20 projects (4 already completed, with chat history and reviews), 50 portfolio items and 40 applications. Every seeded account uses the password `password123`.

## Create an admin account
Admins cannot self-register. Create the first one with:

    docker compose exec backend python -m app.create_admin --email you@company.com

It asks for a password (at least 8 characters). The demo data also includes `admin@example.com` with the password `password123`. Remove it in any shared environment.

## Database migrations
Migrations run automatically when the backend container starts (`alembic upgrade head`). After changing a model:
    cd backend && alembic revision --autogenerate -m "describe the change" && alembic upgrade head
Note: the migrations were generated and tested on SQLite. Check them on your first Postgres start.
If you ran an earlier version of this project, its database was created without migrations. Reset it once with `docker compose down -v` before `docker compose up --build`.

## Run the frontend without Docker
    cd frontend && npm install && npm run dev
The dev server proxies /api to http://localhost:8000. Set VITE_API_URL to call a different API address.

## Run tests (no Docker needed)
    cd backend && pip install -r requirements.txt && pytest
    cd frontend && npm install && npm test

## What works now
- Register as BRAND or CREATOR (admins cannot self-register)
- Login, refresh token, GET /api/v1/auth/me
- Role guard `require_roles(...)`; responses use {success, data, message} / {success, error}
- Argon2 password hashing, JWT access + refresh tokens

- Creator profile setup: PATCH /api/v1/creators/me (skills, niches, languages, AI tools, pricing)
- Creator search: GET /api/v1/creators with q, category, niche, language, ai_tool, min_price, max_price, min_rating, delivery_days, sort, page, page_size
- Portfolio: POST/DELETE /api/v1/creators/me/portfolio, GET /api/v1/creators/{id}/portfolio
- Jobs: POST /api/v1/projects (brands), GET /api/v1/projects (public, OPEN only), GET /api/v1/projects/{id}
- Dropdown data: GET /api/v1/creators/lookups
- Applications: POST /api/v1/applications, GET /applications/mine, GET /applications/project/{id} (brand), POST /applications/{id}/accept | reject | withdraw
- Hiring creates a contract; the fee comes from PLATFORM_FEE_PERCENT (default 20, so 5000 splits into 4000 for the creator and 1000 platform fee)
- Workflow: POST /deliverables, POST /revisions, GET /projects/mine, GET /projects/{id}/workspace, POST /projects/{id}/approve | complete | cancel
- Notifications: GET /api/v1/notifications, GET /notifications/unread-count, POST /notifications/{id}/read, POST /notifications/read-all
- Messaging: GET /api/v1/messages/project/{id} (polled every 5 seconds by the UI), POST /api/v1/messages. Only the brand and hired creator can read or write
- Reviews: POST /api/v1/reviews (after a project is completed, once per side), GET /reviews/creator/{id}. A brand's review updates the creator's rating
- Payments: hiring creates a PENDING payment. The brand funds it (POST /api/v1/payments/project/{id}/fund, status HELD). Completing the project releases it to the creator (RELEASED). Cancelling refunds a funded payment (REFUNDED)
- Earnings: GET /api/v1/payments/mine (history, totals per currency, monthly chart data), POST /api/v1/payments/withdraw (creators, up to their available balance)
- Payment provider: all money movement goes through `PaymentProvider` in `app/services/payment_providers.py`. `PAYMENT_PROVIDER=mock` is the only one built in. To add Stripe or Razorpay, subclass `PaymentProvider`, register it in `PROVIDERS` and set `PAYMENT_PROVIDER` in `.env`. The business rules in `payment_service.py` do not change
- AI brief: POST /api/v1/ai/brief (brands, limited to 10 per minute per user). Without a key it returns a clearly labelled template draft. With `API_KEY` set it asks the model (`AI_MODEL`) and falls back to the template if the call fails
- Creator matching: GET /api/v1/ai/match/{project_id} (brand owner) returns creators with `match_score` (0 to 100), reasons and warnings. GET /api/v1/ai/recommendations/projects (creators) returns open projects ranked for them
- Matching rules (weights add up to 100): skill 30, language 15, niche 15, budget 15, content type 10, rating and experience 10, keyword overlap 5, minus 10 if the creator's delivery time may miss the deadline. The logic is behind `MatchingStrategy` in `app/services/matching.py`, so an LLM strategy can be added later and selected with `MATCHING_STRATEGY`
- Company profile: GET and PATCH /api/v1/brands/me (industry feeds the matching)
- Admin (all need an ADMIN account): GET /api/v1/admin/stats, /users, /creators, /brands, /projects, /payments, /reports (with search, filters and pagination), GET /admin/projects/{id} and /admin/payments/{id} for details
- Moderation: POST /admin/users/{id}/suspend (blocks login and existing tokens, hides the creator), POST /admin/creators/{id}/verify, POST /admin/creators/{id}/feature (featured creators sort first), POST /admin/reports/{id}/resolve (REMOVE_CONTENT, RESOLVE or DISMISS), GET/POST/DELETE /admin/categories/{kind}
- Reports: any signed-in user can POST /api/v1/reports for a creator profile, project, review or portfolio item. Removing content is only allowed for open projects, reviews and portfolio items. Removing a review recalculates the creator's rating
- Verification: creators request it with POST /api/v1/creators/me/verification-request and an admin approves it
- Files: POST /api/v1/files (multipart: purpose, optional project_id, file). Purposes: AVATAR, LOGO, PORTFOLIO (public), DELIVERABLE, ATTACHMENT, ASSET (private). Allowed types are checked by extension and by the file's first bytes, with size limits per purpose. SVG is refused. Public files are served at /files/{id}/content. Private files have no permanent URL: GET /files/{id}/link returns a signed link that expires after 5 minutes, and only for people allowed to see the file
- Storage: local disk by default (the `uploads` Docker volume). Set `S3_BUCKET` (and the other S3 settings) to use S3 or any S3-compatible service. The code behind it is `app/services/storage.py`
- Live chat: a WebSocket at /api/v1/messages/ws/{project_id}?token=... tells both people when something changed, and the page falls back to polling if it drops. It lives in one process, so running several backend instances needs a shared broker such as Redis (see `app/services/realtime.py`)
- Password reset: POST /auth/forgot-password and /auth/reset-password. The link lasts 30 minutes and stops working once used. Login and reset requests are rate limited
- Email: set `EMAIL_BACKEND=smtp` and the SMTP settings to send real email. The default `console` backend only prints emails to the backend log. Emails go out only after the action has been saved, and users can turn them off at /notifications. Which notifications send email is listed in `EMAIL_TYPES` in `notification_service.py`
- Audit log: every admin action is recorded (GET /admin/audit, Audit log tab)
- Project status flow: OPEN, IN_PROGRESS, DRAFT_SUBMITTED, REVISION_REQUESTED, FINAL_SUBMITTED, APPROVED, COMPLETED (or CANCELLED)

## Frontend pages
- Public: / , /creators (filters in the URL), /creators/:id, /jobs, /jobs/:id, /how-it-works, /pricing, /about, /login, /register
- Creator: /dashboard/creator/profile (edit profile, tags, portfolio)
- Creator: /dashboard/creator (your work and applications)
- Brand: /dashboard/brand (projects), /dashboard/brand/profile (company profile), /dashboard/brand/projects/new, /dashboard/brand/projects/:id/applications
- Admin: /dashboard/admin (overview, users, creators, brands, projects, payments, reports, categories)
- Both: /projects/:id/workspace (brief, deliverables, revisions, messages, reviews, payment), /notifications, /dashboard/payments (brand payments or creator earnings, chart and withdrawals)

## Roadmap
Done: 1 foundation, 2 marketplace, 3 transactions, 4 communication. Done: 5 payments, 6 AI, 7 admin.

## Known gaps
- **Real payment gateway.** Only the mock provider exists, behind the `PaymentProvider` interface. Moving real money also needs a Stripe Connect or Razorpay Route account for each creator (identity checks and bank details), webhook handling and testing with your own keys. That is a design and compliance task, so it was not guessed at here
- **"Continue with Google".** The button is shown but disabled. It needs Google OAuth credentials from you
- **Single-instance assumptions.** Live chat and the rate limiter keep state in memory. Several backend instances need Redis for both
- **File handling.** Uploaded files are not deleted when the thing they belong to is removed, there is no virus scanning, and video does not support seeking (no HTTP range requests)
- **Chat sockets** pass the login token in the URL. It is short-lived, but a proxy log could record it
- **Migrations and Docker** were tested on SQLite and with the test suites, not on a live PostgreSQL server. Check the first `docker compose up`
- **Browser testing.** The frontend tests simulate the app with a fake API. Nothing has been clicked through in a real browser or checked on a phone
