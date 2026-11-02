# nbdevlab

Source of [nbdevlab.com](https://www.nbdevlab.com), my homelab and projects site: React + Vite + TypeScript on
Cloudflare Workers.

This is a public snapshot of my private working repo, which is what deploys the site. Content (projects,
pages, images) lives in the site's D1 database and R2 bucket, not here.
  
## Included

- Black + white glassmorphism UI with animated intro sequence.
- Intro state machine:
  - `hgdeklac` slot-machine scramble -> `nbdevlab`
  - tasteful white digital rain backdrop
  - `Enter Website` gate button
  - fade-out to navbar drop + glass card stagger reveal
- Public routes:
  - `/` skeleton-style homepage
  - `/about` dedicated About page
  - `/projects` dedicated Projects page
  - `/skills` dedicated Skills page
  - `/status` stack status page backed by the public tunnel API
  - `/homelab` responsive homelab map, infrastructure inventory, and animated traffic paths
  - `/weather` Tempest weather station page backed by a Worker-side token proxy
  - `/contact` dedicated Contact page
- Admin route:
  - `/admin` credential login backed by Worker secrets (`ADMIN_USER`/`ADMIN_PASS` or `USER`/`PASS`)
  - home layout card builder (add/edit/resize/reorder/show-hide)
  - homepage main card editor (eyebrow/title/intro)
  - project CRUD + reorder + image upload/delete
  - contact settings editor
  - inbound message status management
- Cloudflare data/storage plan:
  - D1 for structured content
  - R2 for image objects

## Scripts

- `npm run dev` - Vite local dev server (frontend)
- `npm run dev:worker` - Run Worker locally with API + static asset routing
- `npm run dev:admin` - Local `/admin` sandbox on http://localhost:5181/admin: its own empty database and image bucket in `.admin-sandbox.local/`, login from `.dev.vars`
- `npm run build` - Typecheck + production build
- `npm run deploy` - Deploy Worker + `dist` assets
- `npm run test` - Vitest tests
- `npm run lint` - ESLint

## Cloudflare Setup

1. Create D1 database and R2 bucket.
2. Replace placeholder values in `wrangler.toml`:
   - `database_id`
   - `bucket_name` (if different)
3. Apply schema:

```bash
npx wrangler d1 execute nbdevlab-db --file=./migrations/0001_init.sql
npx wrangler d1 execute nbdevlab-db --file=./migrations/0002_home_cards.sql
npx wrangler d1 execute nbdevlab-db --file=./migrations/0003_home_hero_settings.sql
```

4. Build and run through Worker runtime:

```bash
npm run build
npm run dev:worker
```

5. Deploy Worker:

```bash
npm run deploy
```

6. Set admin auth secrets on the Worker:

```bash
npx wrangler secret put ADMIN_USER
npx wrangler secret put ADMIN_PASS
npx wrangler secret put ADMIN_SESSION_SECRET
```

7. Optional status page config:

```bash
npx wrangler secret put STATUS_API_BASE_URL
```

Defaults to `https://api.nbdevlab.com` when unset. Use this only if you want the site worker to
read a different public status origin.

8. Optional Tempest weather station config:

```bash
npx wrangler secret put TEMPEST_ACCESS_TOKEN
npx wrangler secret put TEMPEST_STATION_ID
npx wrangler secret put TEMPEST_API_BASE_URL
```

`TEMPEST_ACCESS_TOKEN` enables live weather data. `TEMPEST_STATION_ID` is optional; when unset,
the Worker resolves the first station available to the token. `TEMPEST_API_BASE_URL` defaults to
`https://swd.weatherflow.com/swd/rest`. For local testing, put non-production values in `.dev.vars`;
the site shows placeholder weather metrics when the access token is absent.

Tempest API references:

- https://weatherflow.github.io/Tempest/api/
- https://apidocs.tempestwx.com/reference/get_observations-stn-station-id
- https://weatherflow.github.io/Tempest/api/ws.html

## API Surface

Public:

- `GET /api/public/projects`
- `GET /api/public/projects/:slug`
- `GET /api/public/home-cards`
- `GET /api/public/site-settings`
- `GET /api/public/stack-status`
- `GET /api/public/weather-station`
- `POST /api/public/contact`
- `GET /api/public/images/:id`

Admin:

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/session`
- `GET /api/admin/projects`
- `POST /api/admin/projects`
- `PUT /api/admin/projects/:id`
- `DELETE /api/admin/projects/:id`
- `POST /api/admin/projects/reorder`
- `POST /api/admin/projects/:id/images`
- `PUT /api/admin/projects/:id/images` (reorder; the first image is the cover)
- `DELETE /api/admin/images/:id`
- `GET /api/admin/home-cards`
- `POST /api/admin/home-cards`
- `PUT /api/admin/home-cards/:id`
- `DELETE /api/admin/home-cards/:id`
- `POST /api/admin/home-cards/reorder`
- `GET /api/admin/site-settings`
- `PUT /api/admin/site-settings`
- `GET /api/admin/messages`
- `PUT /api/admin/messages/:id`


## Cinematic 404

Missing document URLs serve the NBDEVLAB orbital 404 with an actual HTTP 404 response, including nested paths. Existing app routes continue to load normally on direct visits and refreshes. API misses retain the API's JSON response. Client-side misses open the same isolated scene without mounting the homepage intro or site overlays.

The standalone page is `public/404.html`; its scripts, textures, wordmark, credits, and soundtrack are under `public/404-assets/`. These use root-relative URLs so they also load from deeply nested missing addresses. Return Home and the wordmark navigate the top window to `https://www.nbdevlab.com/`. The prototype's Saved Cinema link is removed.

The page first attempts autoplay with sound. If browser policy or audio loading prevents it, the picture starts silently and Sound Off remains toggleable. Enabling sound joins the current picture time; pause, replay, visibility changes, and skip keep the two in sync. The original piano and garbled-radio mix is preserved in the seekable soundtrack; `score.js` retains the Web Audio composition source. Reduced-motion visitors see the final 404 immediately.

Cloudflare's existing Worker build integration deploys this from `main`. `wrangler.toml` now uses `assets.not_found_handling = "404-page"`, and the Worker only rewrites recognized SPA document routes to the app entry. No dashboard Custom Error Page or separate rule is required. Build settings can be checked under **Workers & Pages → nbdevlab → Settings → Build** (repository `0xC0FFEEBEEF/nbdevlabremix`, production branch `main`, build `npm run build`, deploy `npm run deploy` or `npx wrangler deploy`).

Validate locally with `npm run build` followed by `npm run dev:worker`; an unknown URL should return 404 with the scene, `/about` should return 200, and `/api/not-a-route` should return the JSON 404.

## License

The code is under the GNU General Public License v3.0 or later, see [`LICENSE`](LICENSE). The media and fonts in `public/404-assets/` keep their own
licenses: see `public/404-assets/credits.html` and the fonts' OFL files.


## License

The code is under the GNU General Public License v3.0 or later, see [`LICENSE`](LICENSE). The media and fonts in `public/404-assets/` keep their own
licenses: see `public/404-assets/credits.html` and the fonts' OFL files.

<sub>Preparing this public copy from my private repo was done with help from Claude.</sub>
