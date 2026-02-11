# myApp Backend

A backend API built with Node.js and Hono framework.

## Features

- 🚀 Fast Hono framework
- 📝 TypeScript support
- 🔧 Hot reload with tsx
- 📊 Built-in logging and CORS
- 🏥 Health check endpoints
- 📁 Organized project structure

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## API Endpoints

### Health Check
- `GET /health` - Health status
- `GET /ping` - Simple ping response

### API v1
- `GET /api/v1/hello` - Welcome message
- `GET /api/v1/users` - Get all users
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create new user

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # Main server file
│   ├── middleware/       # Custom middleware
│   │   └── requestLogger.ts
│   └── routes/           # Route handlers
│       └── health.ts
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Development

The project uses:
- **Hono**: Web framework
- **TypeScript**: Type safety
- **tsx**: Fast TypeScript execution
- **ESLint**: Code linting

## Environment Variables

See `.env.example` for required environment variables.