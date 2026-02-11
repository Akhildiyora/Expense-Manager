# FinTrack - Personal & Trip Expense Tracker

A full-stack expense management application built with **React**, **Hono**, and **Supabase**. FinTrack allows you to manage personal expenses, track trip-specific spending with friends, and visualize your financial data with beautiful interactive charts.

## 🚀 Features

- **Personal Expenses**: Track your daily spending, categorize transactions, and set payment modes (Cash, Online, Card).
- **Trip Management**: Create trips, add members, and track shared expenses. Includes a settlement algorithm to minimize transactions between friends.
- **Interactive Dashboard**: Real-time spending trends, category breakdowns, and budget tracking.
- **Smart Categorization**: Support for Main and Subcategories with automatic roll-up of totals.
- **Friends & Splits**: Invite friends to share expenses. View detailed balances (You owe / Owed to you).
- **Real-time Sync**: Uses Supabase real-time subscriptions to keep data updated across all tabs.

## 🛠️ Tech Stack

### Frontend (`/myApp`)
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **Database Client**: Supabase JS
- **Charts**: Recharts

### Backend (`/backend`)
- **Framework**: Hono (Hono.js)
- **Runtime**: Node.js / tsx
- **Type Safety**: TypeScript & Zod

### Database
- **Provider**: Supabase (PostgreSQL)
- **Schema**: Includes tables for `expenses`, `categories`, `trips`, `trip_members`, and `expense_splits`.

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase Account

### Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd "TypeScript Project"
   ```

2. **Frontend Setup**:
   ```bash
   cd myApp
   npm install
   ```
   Create a `.env` file in `/myApp` with:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Backend Setup**:
   ```bash
   cd ../backend
   npm install
   ```
   Create a `.env` file in `/backend` with:
   ```env
   # Backend specific envs if any
   ```

4. **Run the Application**:
   Open two terminals:
   - Terminal 1 (Frontend): `cd myApp && npm run dev`
   - Terminal 2 (Backend): `cd backend && npm run dev`

## 📊 Database Schema
The project includes several SQL scripts in the root and `/backend` directories:
- `supabase_schema_fix.sql`: Sets up core tables and RLS policies.
- `add_payment_mode.sql`: Migration for payment methods.

## 📝 License
MIT
