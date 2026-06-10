# praxisAI

Hebrew-first AI clinical platform for physiotherapy clinics in Israel.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Auth + PostgreSQL + RLS)
- **Tailwind CSS** (RTL-first)
- **Deepgram Nova-2** (Hebrew transcription)
- **Claude API** (SOAP notes, documents, chat)

## Setup

### 1. Clone & install
```bash
git clone https://github.com/ormaman-svg/praxisai.git
cd praxisai
npm install
```

### 2. Environment variables
```bash
cp .env.local.example .env.local
# Fill in your keys
```

### 3. Supabase — enable Google Auth
1. Create project at [supabase.com](https://supabase.com)
2. Authentication → Providers → Google → Enable
3. Add your Google OAuth Client ID + Secret
4. Set redirect URL to: `https://your-domain.com/auth/callback`

### 4. Google Cloud Console
1. [console.cloud.google.com](https://console.cloud.google.com) → APIs → OAuth 2.0
2. Authorized redirect URIs: `https://<your-project>.supabase.co/auth/v1/callback`

### 5. Run locally
```bash
npm run dev
```

### 6. Deploy on Vercel
Connect the repo, add env vars, deploy.

## Environment variables
| Key | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `DG_KEY` | Deepgram API key |
| `CL_KEY` | Anthropic API key |
