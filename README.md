# 🚀 CueGrowth – X.com (Twitter) Outreach Automation & Intelligence Platform

> Intelligent outreach automation system for identifying, tracking, and engaging leads on X (Twitter)  
> **Built with NestJS + PostgreSQL + Redis + Playwright + BullMQ + Prisma**

---

## 🧩 Overview

CueGrowth aims to automate social outreach for salespeople.  
It can:

- 🔍 **Scrape** X profiles (authenticated login)
- 🎯 **Create & manage campaigns**
- 🤖 **Automate follow-ups & deal flow**
- ⚡ **Handle real-time sync + analytics**
- 🧠 Form the base of an **AI-driven social intelligence engine**

---

## 🧱 Tech Stack

| Layer | Technology |
| :---- | :---------- |
| **Backend** | NestJS (TypeScript) |
| **Database** | PostgreSQL + Prisma ORM |
| **Cache / Queue / Events** | Redis + BullMQ + Pub/Sub |
| **Scraping** | Playwright (Chromium) |
| **Auth** | Google OAuth 2.0 + JWT rotation |
| **Rate Limiter** | rate-limiter-flexible (Redis) |
| **Docs** | Swagger (OpenAPI) |
| **Infra** | Docker Compose (Postgres + Redis) |

---

## 📁 Project Structure

```text
backend/
│
├── src/                                 # Source code
│   ├── auth/                            # Google OAuth + JWT rotation
│   ├── campaigns/                       # Campaign CRUD + CSV upload + assign
│   ├── deals/                           # Deal management + stage update
│   ├── events/                          # Pub/Sub handler + DLQ + dedup
│   ├── scraper/                         # Playwright scraping + BullMQ queue
│   ├── prisma/                          # Prisma service / module
│   ├── app.module.ts                    # Root NestJS module
│   └── main.ts                          # Application bootstrap
│
├── prisma/                              # Prisma schema + migrations
│   ├── schema.prisma
│   └── migrations/
│
├── infra/                               # Infrastructure layer
│   └── docker-compose.yml               # Postgres + Redis containers
│
├── Dockerfile                           # Docker build for backend service
├── package.json                         # NPM dependencies and scripts
├── tsconfig.json                        # TypeScript configuration
├── .env                                 # Environment variables
├── .gitignore                           # Git ignore rules
└── README.md                            # Project documentation




---

## ⚙️ Environment Variables

Create a `.env` file inside `/backend` 👇

```env
# --- Database ---
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cuegrowth?schema=public"

# --- Redis ---
REDIS_URL="redis://localhost:6379"

# --- App Config ---
PORT=4000
NODE_ENV=development

# --- JWT ---
JWT_ACCESS_SECRET="dev_access_secret"
JWT_REFRESH_SECRET="dev_refresh_secret"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="7d"

# --- Google OAuth ---
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:4000/auth/google/callback"

# --- Scraper / BullMQ ---
BULL_CONCURRENCY="2"
SCRAPER_HEADLESS="true"
SCRAPER_COOKIE_FILE="./cookies.json"


# 1️⃣ Navigate to the Infra Folder
cd backend/infra

# 2️⃣ Start Containers
docker compose up -d

# 3️⃣ Verify Services Are Running
docker ps

# 4️⃣ Test Postgres Connection
docker exec -it cuegrowth_db psql -U postgres -d cuegrowth

# 5️⃣ Test Redis Connection
docker exec -it cuegrowth_redis redis-cli
PING

# 6️⃣ Stop & Remove Containers
docker compose down


# 🧱 Prisma Setup
cd ../
npm install
npx prisma generate
npx prisma migrate dev --name init


# 🚀 Run API
npm run start:dev


# 🔐 Test Google OAuth Login (open in browser)
http://localhost:4000/auth/google


# 🕷️ ScraperService – Enqueue scrape jobs
curl -X POST http://localhost:4000/scrape \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://x.com/elonmusk","https://x.com/TwitterDev"]}'


# 🎯 Create Campaign
curl -X POST http://localhost:4000/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name":"AI Outreach Batch 1","description":"Founders"}'


# 📎 Assign Usernames or URLs to Campaign
curl -X POST http://localhost:4000/campaigns/<campaignId>/assign \
  -H "Content-Type: application/json" \
  -d '{"usernames":["elonmusk","BillGates"]}'


# 📤 Upload CSV of Leads
curl -X POST http://localhost:4000/campaigns/<campaignId>/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@leads.csv"


# 🔄 Update Deal Stage
curl -X PATCH http://localhost:4000/deals/<dealId>/stage \
  -H "Content-Type: application/json" \
  -d '{"stage":"contacted","followUpStatus":"sent"}'


