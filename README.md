# Daily Quests — Chore & Allowance Dashboard

A Next.js app for Zach and Kyle's chore checklist and allowance ledger, styled
as a blocky pixel-art "quest board." Data is stored server-side in Redis so it
persists across visits and syncs for anyone viewing the dashboard.

## 1. Push to GitHub

```bash
cd chore-dashboard
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repo on GitHub (github.com/new — don't initialize it with a
README), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/chore-dashboard.git
git branch -M main
git push -u origin main
```

## 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New → Project**, select the `chore-dashboard` repo, and click
   **Deploy**. Vercel auto-detects Next.js — no config needed.
3. It'll deploy successfully, but the dashboard won't save anything yet
   because there's no database connected. That's step 3.

## 3. Add a Redis database (for persistence)

Vercel's own KV product was sunset; the current path is a Marketplace Redis
integration (Upstash), which is what this app's `/api/data` route expects.

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database** (or **Connect Database**) → choose a **Redis /
   KV** option from the Marketplace (Upstash).
3. Follow the prompts to create it and **connect it to this project**. Vercel
   will automatically add the right environment variables
   (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` /
   `UPSTASH_REDIS_REST_TOKEN` depending on the integration version — the code
   already checks for both).
4. Go to **Deployments**, open the latest deployment's menu, and choose
   **Redeploy** so the new environment variables take effect.

Open your Vercel URL (something like `chore-dashboard.vercel.app`) and confirm
you can check a chore and it still shows checked after a refresh — that
confirms Redis is wired up.

## 4. Add it as a card in Home Assistant

The simplest approach is an iframe/webpage card pointing at your Vercel URL.

**Using the UI:**
1. Edit your Home Assistant dashboard → **Add Card**.
2. Search for **Webpage** (the built-in `iframe` card).
3. Set the URL to your Vercel deployment, e.g.
   `https://chore-dashboard.vercel.app`.
4. Set a height that fits your layout (this dashboard is designed to look
   good around 700–900px tall).

**Or using YAML mode**, add this to your dashboard:

```yaml
type: iframe
url: https://chore-dashboard.vercel.app
aspect_ratio: 100%
```

If this card lives on a dedicated wall-mounted tablet, you may prefer running
that tablet in **kiosk mode** (e.g. via Fully Kiosk Browser on Android)
pointed directly at your Home Assistant dashboard URL, so it behaves like a
dedicated panel rather than a phone-style app.

## Notes

- Both boys' data is shared (not per-login) — anyone with the URL sees the
  same board, which is the intended setup for a shared wall tablet.
- Boy names and the chore list are editable directly in the app (pencil icons)
  — no code changes needed to rename or adjust chores later.
- Every push to `main` on GitHub auto-redeploys on Vercel.
