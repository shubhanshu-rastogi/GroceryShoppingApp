# Verdant Cart

A beautiful online fruits & vegetables shopping cart with an admin console for managing categories, products, pricing, inventory, and images.

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

The API runs at `http://localhost:4000`.

### 2) Frontend
Serve the static frontend (recommended):
```bash
cd /Users/shubhanshurastogi_1/Learning/WebApps
python3 -m http.server 5173
```

Open `http://localhost:5173`.

## Admin Login
Use the credentials in `server/.env`:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

## API Endpoints (summary)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/catalog`
- `POST /api/categories` (admin)
- `POST /api/products` (admin)
- `PUT /api/products/:id` (admin)
- `POST /api/orders`
