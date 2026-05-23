# SecondBrain H5 Dashboard

A mobile-first personal knowledge management dashboard, built on the [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) methodology.

Instead of traditional RAG (retrieving from raw files each time), AI compiles raw materials into a growing wiki knowledge network. This H5 dashboard lets you browse the knowledge base from your phone — daily input list, AI-generated daily report, and project management dashboard.

## Tech Stack

**Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS v3 + GSAP (animation)

**Backend**: Python FastAPI + uvicorn

**Design**: Liquid Glass (frosted glass + dark theme + pastel WebGL background)

## Features

- **Input List** — Browse daily articles/videos with density ranking and source color coding
- **Daily Report** — AI-generated knowledge digest rendered as Markdown
- **Dashboard** — Wiki stats, milestone tracking, system health, knowledge visualization
  - Knowledge Overview: ring chart (6 wiki categories) + clickable tag cloud
  - Knowledge Network: bubble layout showing active wiki pages by link count
- **Password Protection** — Server-side auth with 7-day token per device/IP

## Project Structure

```
frontend/          # React SPA (Vite)
├── src/
│   ├── sections/  # Page components (LockScreen, InputList, DailyReport, Dashboard)
│   ├── lib/       # API client, utilities
│   └── types/     # TypeScript interfaces
├── package.json
└── vite.config.ts # Multiple build modes (daily/domain)

backend/           # FastAPI server
├── server.py      # API endpoints (auth, digest, daily report, metrics, heartbeat)
└── requirements.txt

docs/
└── H5-design-spec.md  # Full design specification
```

## Getting Started

### Frontend (Development)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Frontend (Build)

```bash
npm run build:daily   # Base path: /daily/ (legacy IP access)
npm run build:domain  # Base path: / (domain access)
```

### Backend

```bash
cd backend
pip install -r requirements.txt
SB_AUTH_PASSWORD=your_password python server.py
# Server starts on http://localhost:8001
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SB_AUTH_PASSWORD` | H5 access password | Yes |

## Design Philosophy

> The right amount of complexity is what the task actually requires — no speculative abstractions, but no half-finished implementations either.

- Mobile-first, touch-optimized
- No external chart libraries — pure CSS/SVG for all visualizations
- Privacy-first: only aggregated tag counts and link metrics leave the local network
- Dark theme with frosted glass effects optimized for OLED screens

## License

MIT
