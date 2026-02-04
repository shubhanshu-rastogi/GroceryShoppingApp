# Verdant Cart

A beautiful online fruits & vegetables shopping cart with an admin console for managing categories, products, pricing, inventory, and images.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shubhanshu-rastogi/GroceryShoppingApp)

## Features
- Shopper: search, filters, sorting, cart, checkout, delivery fee logic
- Admin: category management, product creation, price/stock updates, image URLs
- Auth: email + password with JWT
- Persistent backend with PostgreSQL + Prisma
- Fallback product images when no URL is provided

## Tech Stack
- Frontend: HTML, CSS, Vanilla JS
- Backend: Node.js, Express, Prisma
- Database: PostgreSQL

## Prerequisites
- Node.js 20.x
- PostgreSQL running locally

## Local Setup

### 1) Backend
```bash
cd /Users/shubhanshurastogi_1/Learning/WebApps/server
npm install
cp .env.example .env
```

Update `server/.env`:
- `DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`

Run migrations and start the API:
```bash
npx prisma migrate dev
npm run dev
```

The API (and frontend) run at `http://localhost:4000`.

### 2) Frontend
Optional: serve the static frontend separately:
```bash
cd /Users/shubhanshurastogi_1/Learning/WebApps/server/public
python3 -m http.server 5173
```

Open `http://localhost:5173`.

## Admin Login
Use the credentials in `server/.env`:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## Deploy on Render
This repo includes `render.yaml` for a single web service + Postgres.
Steps:
1. Create a new Render Blueprint and point it to this repo.
2. After provisioning, update `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `JWT_SECRET` in the Render dashboard.
The service serves the frontend from `server/public` and the API from the same domain.

## API Endpoints (summary)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/catalog`
- `POST /api/categories` (admin)
- `POST /api/products` (admin)
- `PUT /api/products/:id` (admin)
- `POST /api/orders`
