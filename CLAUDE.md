# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application for a "BeraBaddie" waitlist system - a Y2K-themed NFT customization platform built for the Berachain ecosystem. Users can join a waitlist via Twitter OAuth, optionally connect their Berachain wallet, and receive referral codes for sharing.

## Common Commands

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Dependencies
npm install          # Install dependencies
```

## Architecture & Key Components

### Authentication & User Flow
- **NextAuth.js** with Twitter OAuth 2.0 provider
- **Supabase** for data storage and user management
- Multi-step onboarding: Twitter auth → optional wallet connection → referral code generation

### Core Files Structure
- `app/page.tsx` - Main entry point, renders WaitlistApp component
- `app/layout.tsx` - Root layout with SessionProvider wrapper
- `app/providers.tsx` - Client-side NextAuth SessionProvider wrapper
- `app/api/auth/[...nextauth]/route.ts` - NextAuth configuration and Twitter OAuth handler
- `components/WaitlistApp.tsx` - Main application component with all waitlist logic

### Key Features & Data Flow
1. **User Authentication**: Twitter OAuth stores user data (handle, follower count, verification status) in Supabase
2. **Waitlist Management**: Users displayed by follower count, real-time stats tracking
3. **Wallet Integration**: Optional Berachain wallet address collection for beta perks
4. **Referral System**: Clean referral codes generated from Twitter handles
5. **Social Sharing**: Twitter share integration with referral links

### Database Schema (Supabase)
- `waitlist_users` table with fields: twitter_id, twitter_handle, twitter_name, twitter_avatar, follower_count, is_verified, wallet_address, referral_code, created_at

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`

### Styling & UI
- **Tailwind CSS 4** for styling
- Y2K-themed pink gradient design
- Responsive layout with mobile-first approach
- Lucide React icons for UI elements

### TypeScript Configuration
- Strict mode enabled
- Path aliases: `@/*` maps to project root
- Next.js plugin for enhanced IDE support

## Development Notes

- Component uses 'use client' directive for client-side functionality
- Complex state management for multi-step user onboarding flow
- Debug logging present in development (should be removed for production)
- Twitter API v2.0 integration for enhanced user data
- Supabase real-time capabilities for live waitlist updates