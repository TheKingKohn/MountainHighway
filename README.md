
# Mountain Highway

A marketplace monorepo built with Node.js, React, and TypeScript.

## Project Structure

```
mountain-highway/
├── packages/
│   ├── api/          # Node.js + Express + Prisma API
│   └── web/          # React + Vite frontend
├── package.json      # Root workspace configuration
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm (comes with Node.js)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Development

Start both API and web servers concurrently:

```bash
npm run dev
```

This will start:
- API server on http://localhost:4000
- Web development server on http://localhost:5173

### Individual Package Commands

#### API (`packages/api`)

```bash
cd packages/api

# Development
npm run dev

# Database migrations
npm run migrate

# Seed database
npm run seed

# Build for production
npm run build

# Lint
npm run lint
```

#### Web (`packages/web`)

```bash
cd packages/web

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

## Environment Variables

### API (`.env` in `packages/api`)

```env
PORT=4000
JWT_SECRET=your-jwt-secret-key-here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
PLATFORM_FEE_BPS=800
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL="file:./dev.db"
```

### Web (`.env` in `packages/web`)

```env
VITE_API_URL=http://localhost:4000
```

## Database Schema

The application uses Prisma with SQLite for development (PostgreSQL ready for production).

### Models

- **User**: User accounts with optional Stripe integration
- **Listing**: Marketplace items for sale
- **Order**: Purchase orders with escrow functionality
- **Message**: Order-related communications

## API Endpoints

- `GET /health` - Health check endpoint (returns `{ok: true}`)
- `GET /` - API information

## Technology Stack

### Backend (API)
- Node.js 20
- Express.js
- TypeScript
- Prisma ORM
- SQLite (development) / PostgreSQL (production)
- Zod for validation
- bcryptjs for password hashing
- jsonwebtoken for authentication
- Stripe for payments

### Frontend (Web)
- React 18
- Vite
- TypeScript
- React Router DOM
- Axios for API calls

### Development Tools
- ESLint + Prettier (shared configuration)
- Concurrently for running multiple services
- ts-node-dev for API development

## Scripts

### Root Level

- `npm run dev` - Start both API and web development servers
- `npm run build` - Build both packages for production
- `npm run lint` - Lint both packages

## License

MIT
