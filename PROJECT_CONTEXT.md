# Project Context: Family Budget Telegram Mini App

## Overview
A Telegram Mini App for two users to manage a joint family budget. It allows tracking of income/expenses and recurring monthly obligations (credits).

## Tech Stack
- **Frontend**: Vanilla JS, HTML5, CSS3 (Tailwind style via CDN or custom CSS).
- **Hosting**: GitHub Pages (Static hosting).
- **Database & Backend**: Supabase (PostgreSQL).
- **Platform**: Telegram Mini Apps.

## Current Infrastructure
- **Supabase Project**: 
  - URL: `https://civmjhjefyxxddawbstk.supabase.co`
  - Key: `sb_publishable_zO47rJfcZVCyRO-JiruFbA_zrQCs3wn`
- **Security**: Row Level Security (RLS) is currently disabled for simplicity in development (`ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;`). Access to the UI is restricted via a hardcoded list of Telegram User IDs.

## Database Schema
1. `transactions`: 
   - `id` (uuid)
   - `created_at` (timestamp)
   - `amount` (numeric)
   - `description` (text)
   - `type` (plus/minus)
2. `recurring_credits`:
   - `id` (uuid)
   - `name` (text)
   - `amount` (numeric)
   - `next_due_date` (timestamp)
   - `is_active` (boolean)

## Completed Features
- [x] Basic UI with balance display and transaction list.
- [x] Connection to Supabase for real-time data sync.
- [x] Telegram Mini App integration (`WebApp.expand()`).
- [x] User ID filtering for security.
- [x] Styling for mobile devices.

## Pending Tasks (Backlog)
- [ ] **Recurring Credits Logic**: 
  - Automatically suggest creating a transaction when a monthly credit is due.
  - Add "Paid" button which creates a `transaction` and updates the `next_due_date` in `recurring_credits`.
- [ ] **Countdown Timer**: Display time remaining until the next upcoming payment.
- [ ] **Transaction Management**: 
  - Delete functionality (trash icon).
  - Edit functionality for existing transactions.
- [ ] **UI Refinement**: Better handling of empty states and error messages.

## File Structure
- `index.html`: Main entry point.
- `style.css`: Stylesheets.
- `app.js`: Core logic (Supabase client, UI updates, Telegram integration).