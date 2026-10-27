# Support Ticket Triage

A support desk that sorts customer tickets automatically. Customers sign up and send requests from
the web app. For every new ticket the system uses Gemini to decide the **category**, **urgency** and
**customer sentiment**, writes a **one-line summary**, drafts a **reply** for a human to review,
and **assigns the ticket** to an agent who has the right skill and isn't overloaded.

## What each role can do

| Role | Can do |
| --- | --- |
| **Customer** | Register, submit requests (with attachments), follow their status, and comment on their own tickets. |
| **Agent** | Work their ticket queue, claim unassigned tickets, read the AI summary and suggested reply, comment on the ticket, and resolve it. |
| **Manager** | See the dashboard (response times, SLA, categories, agent workload), search and filter every ticket, assign or reassign tickets, re-run AI triage, and add, edit, deactivate or delete agents and their skills. |

A ticket is **overdue** when it has had no first response within **4 hours**.

## Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, Pydantic, JWT (httpOnly cookie)
- **AI:** Google Gemini (`google-genai`), behind a small provider interface
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts, lucide-react

## Project structure

```
backend/
  app/
    api/            controllers: HTTP only (routing, status codes)
    services/       business logic and all database access
    models/         SQLAlchemy models and enums
    schemas/        request and response models
    integrations/   Gemini triage provider
    core/           config, db, security, logging, background sweep
    cli/            management commands (create manager, seed demo data)
  alembic/          database migrations
frontend/
  app/              pages (customer, agent, manager, auth)
  components/       shared UI kit (components/ui), layout, ticket screens
  lib/              API client, auth, helpers
```

The backend follows **controller → service → database**: controllers never touch the database, and
services know nothing about HTTP.

## How a ticket flows

1. A customer submits a request. It is saved right away and the request returns.
2. A background task asks Gemini to triage it. Failures are retried with back-off (1, 2, 4 minutes,
   up to 3 attempts); after that the ticket waits in the manager's **Triage failed** list.
3. The assignment engine picks the least-loaded active agent who has the ticket's category as a
   skill and is under their open-ticket limit. If nobody qualifies, the ticket stays unassigned and
   is picked up by a sweep (every 60 seconds) when someone becomes available.
4. The agent reviews the AI summary and suggested reply, comments for the customer, and resolves.
   Nothing the AI drafts is ever sent without a person posting it.

There is no email: all communication happens on the ticket. There is no external queue either;
background work runs in the API process.

## Getting started

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL (running locally)
- A Gemini API key (https://aistudio.google.com/apikey)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then edit .env (see below)
```

Create an empty database (for example `support_triage`), set `DATABASE_URL` in `.env`, then:

```bash
alembic upgrade head                      # create the tables
python -m app.cli create-manager          # the first manager (or set MANAGER_EMAIL / MANAGER_PASSWORD)
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000 (use `localhost`, not `127.0.0.1`: the API only allows that origin).

### Configuration (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | e.g. `postgresql+psycopg://USER:PASSWORD@localhost:5432/support_triage` |
| `SECRET_KEY` | Signs login tokens. Use a long random value; the app refuses the default in production. |
| `FRONTEND_ORIGIN` | Allowed browser origin (default `http://localhost:3000`) |
| `GEMINI_API_KEY` | Enables AI triage. Without it, tickets stay pending. |
| `GEMINI_MODEL` | Model name (default `gemini-3.1-flash-lite`) |
| `SLA_FIRST_RESPONSE_HOURS` | First-response deadline (default 4) |
| `TRIAGE_MAX_ATTEMPTS`, `TRIAGE_SWEEP_SECONDS` | Retry limit and sweep interval |
| `MAX_ATTACHMENT_MB`, `STORAGE_PATH` | Attachment size limit and where files are stored |
| `MANAGER_EMAIL`, `MANAGER_PASSWORD` | Used by `create-manager` if no flags are given |

Never commit `.env`. It is already in `.gitignore`.

## Demo data (development only)

```bash
python -m app.cli seed-agents --count 100   # 5 sample agents + 100 generated ones
python -m app.cli add-skills                # give agents the newer skills (safe to re-run)
python -m app.cli seed-tickets --count 100  # demo customers and tickets with history
```

Seeded agents use the password `Agent@1234` and seeded customers use `Customer@1234`. These are
for local use only; do not use them anywhere real.

## Ticket categories (also agent skills)

billing, refund, login, account, bug, integration, feature request, cancellation, general.
A category is also the skill an agent needs to receive tickets of that kind.

## Notes and limitations

- Customer email addresses are **not verified**.
- Rate limiting (login, sign-up, ticket creation) is in memory, so it resets on restart and is per
  process.
- The project has no automated tests.
- Gemini can briefly return `503` when a model is overloaded; the retry logic handles this.
