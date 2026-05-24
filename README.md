# Socialess

Mobile app that helps break social media addiction. Earn screen time through physical activity. Play solo or challenge friends.

## Architecture

```
socialess-project/
├── apps/mobile/        # Expo React Native app
└── server/             # Node.js + Express API
```

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Mobile   | React Native (Expo SDK 52), Expo Router v4 |
| State    | Zustand v5, React Query v5 |
| Backend  | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Realtime | Socket.io |
| Auth     | JWT (access + refresh tokens) |

## Getting Started

### 1. Database

```bash
# Create PostgreSQL database
createdb socialess

# Copy env file
cp server/.env.example server/.env
# Edit DATABASE_URL and JWT_SECRET in server/.env
```

### 2. Server

```bash
cd server
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

### 3. Mobile

```bash
cd apps/mobile
npm install
# Create .env file
echo 'EXPO_PUBLIC_API_URL=http://localhost:3000' > .env
echo 'EXPO_PUBLIC_SOCKET_URL=http://localhost:3000' >> .env
npx expo start
```

## Game Rules

- **Daily free time**: 15 minutes on social media (Instagram, YouTube, Snapchat, TikTok, Facebook)
- **Earn more time**:
  - 1 squat = 10 seconds
  - 1 click = 15 seconds
  - 1,000 steps = 90 seconds
- **Max capacity**: 100 minutes
- **Daily crate**: 1 free crate + 1 event card every day
- **Card rarities**: Common, Rare, Epic, Legendary

## Game Modes

| Mode | Description |
|------|-------------|
| Singleplayer | Solo streak-building. Event cards only. |
| Multiplayer | Challenge friends. Use game cards on opponents. Set penalties! |
| Custom | Fully configurable — choose cards, time limits, tracked apps. |

## App Structure (Tabs)

```
[Shop] [Cards*] [Home] [Players*] [Stats]
        * multiplayer only
```

## Card Types

All cards come in Common / Rare / Epic / Legendary rarity:

| Card | Effect |
|------|--------|
| Nerf Activities | -20/30/50/70% time from activities |
| Buff Activities | +20/30/50/70% time from activities |
| Ban Activity | Block an activity for 6/12/24/48 hours |
| Limit Capacity | -20/30/50/70% max time capacity |
| Reduce Time | -10/15/20/30 minutes instantly |
| Increase Time | +10/15/20/30 minutes instantly |
| Time Drain | -2/5/7/10 min/hour |
| Time Flow | +2/5/7/10 min/hour |
| More Cards (MP) | Get 1/2/3/4 extra cards |

## Monetization (Planned)

- **Ads**: 1 free ad crate/day, 1 lucky wheel spin/day via ad
- **Store** (future): Time boosts, premium crates, cards — daily limits prevent pay-to-win
