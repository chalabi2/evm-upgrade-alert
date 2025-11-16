# EVM Upgrades Monitor - Frontend

Modern, responsive frontend for monitoring EVM chain upgrades and network changes.

## Tech Stack

- **Vite** - Fast build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible component library
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and state management
- **date-fns** - Date utility library
- **Lucide React** - Icon library

## Getting Started

### Prerequisites

- Bun (package manager)
- Backend API running on `http://localhost:3000`

### Installation

```bash
bun install
```

### Development

```bash
bun dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
bun run build
```

### Preview Production Build

```bash
bun run preview
```

## Features

- **Dashboard** - Overview of scheduled upgrades and active countdowns
- **Upgrades** - Browse and filter chain upgrades by status and network
- **Chains** - View all monitored EVM chains and their details
- **Events** - Recent on-chain governance and upgrade events
- **Releases** - Latest client software releases

## API Integration

The frontend connects to the backend API through Vite's proxy configuration. All requests to `/v1/*` and `/health` are proxied to `http://localhost:3000`.

To change the backend URL, update the proxy configuration in `vite.config.ts`.

## Project Structure

```
src/
├── components/
│   ├── layout/         # Layout components (Header, Layout)
│   ├── ui/             # Reusable UI components (Button, Card, Badge)
│   ├── countdown-timer.tsx
│   └── upgrade-card.tsx
├── hooks/              # Custom React hooks for data fetching
├── lib/                # Utility functions and API client
├── pages/              # Page components
├── types/              # TypeScript type definitions
├── App.tsx             # Main app component with routing
├── main.tsx            # App entry point
└── index.css           # Global styles with Tailwind
```

## Customization

### Theme

The app uses CSS variables for theming. Modify the colors in `src/index.css` to customize the theme.

### Components

All UI components are built with Tailwind CSS and can be easily customized by modifying their class names or variants.

## License

MIT
