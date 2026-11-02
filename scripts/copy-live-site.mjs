#!/usr/bin/env node
// Copies what the live site shows the public into a local sandbox: settings, home cards, page layouts, published
// projects and their pictures. It only reads the live site through its public GET endpoints, and only writes to the
// local database and image bucket in the folder it is given (wrangler --local). Drafts, contact messages and admin
// data are not public, so they are not copied.
//
// Usage: node scripts/copy-live-site.mjs <state folder>   (the folder must already hold a migrated local database)
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const LIVE = process.env.LIVE_SITE_ORIGIN || 'https://www.nbdevlab.com'
const state = process.argv[2]
if (!state) {
  console.error('Usage: node scripts/copy-live-site.mjs <state folder>')
  process.exit(1)
}

const wrangler = './node_modules/.bin/wrangler'
const downloads = join(state, 'live-copy')
mkdirSync(downloads, { recursive: true })

async function getJson(path) {
  const response = await fetch(`${LIVE}${path}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`${path} answered ${response.status}`)
  }
  const body = await response.json()
  if (!body.success) {
    throw new Error(`${path} failed: ${body.error ?? 'no reason given'}`)
  }
  return body.data
}

async function download(path, name) {
  const response = await fetch(`${LIVE}${path}`)
  if (!response.ok) {
    throw new Error(`${path} answered ${response.status}`)
  }
  const file = join(downloads, name)
  writeFileSync(file, Buffer.from(await response.arrayBuffer()))
  return { file, contentType: response.headers.get('content-type') || 'application/octet-stream' }
}

const sql = (value) => {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }
  return `'${String(value).replace(/'/g, "''")}'`
}
const json = (value) => sql(JSON.stringify(value ?? null))
const safeName = (name) => String(name || 'file').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80)

const now = new Date().toISOString()
const [settings, homeCards, projects, builder] = await Promise.all([
  getJson('/api/public/site-settings'),
  getJson('/api/public/home-cards'),
  getJson('/api/public/projects'),
  getJson('/api/public/builder/bootstrap'),
])

const lines = [
  // The worker adds this column itself on first use; a fresh database does not have it yet.
  "ALTER TABLE site_settings ADD COLUMN status_power_mode TEXT NOT NULL DEFAULT 'live';",
  // Mark the worker's one-time default content and page-builder seeding as done, so it never runs over the copy.
  `INSERT OR REPLACE INTO content_sync_state (sync_key, status, started_at, completed_at, metadata_json)
   VALUES ('site.content_sync.v3', 'completed', ${sql(now)}, ${sql(now)}, '{"source":"live copy"}');`,
  `INSERT OR REPLACE INTO builder_bootstrap_state (bootstrap_key, status, started_at, completed_at, metadata_json)
   VALUES ('builder.bootstrap.v1', 'completed', ${sql(now)}, ${sql(now)}, '{"source":"live copy"}');`,
  'DELETE FROM project_images;',
  'DELETE FROM projects;',
  'DELETE FROM home_cards;',
  'DELETE FROM builder_documents;',
  'DELETE FROM about_images;',
  `UPDATE site_settings SET
     email = ${sql(settings.email ?? '')},
     phone = ${sql(settings.phone ?? '')},
     location = ${sql(settings.location ?? '')},
     socials_json = ${json(settings.socials ?? {})},
     contact_intro = ${sql(settings.contactIntro ?? '')},
     maintenance_mode = ${sql(Boolean(settings.maintenanceMode))},
     maintenance_message = ${sql(settings.maintenanceMessage ?? '')},
     announcement_json = ${json(settings.announcement ?? {})},
     status_power_mode = ${sql(settings.statusPowerMode ?? 'live')},
     home_eyebrow = ${sql(settings.homeEyebrow ?? '')},
     home_title = ${sql(settings.homeTitle ?? '')},
     home_tagline = ${sql(settings.homeTagline ?? '')},
     home_intro = ${sql(settings.homeIntro ?? '')},
     gate_settings_json = ${json(settings.gateSettings ?? {})},
     about_blocks_json = ${json(settings.aboutBlocks ?? [])},
     skills_groups_json = ${json(settings.skillsGroups ?? [])},
     updated_at = ${sql(now)}
   WHERE id = 1;`,
]

for (const card of homeCards) {
  lines.push(`INSERT INTO home_cards (id, title, subtitle, body, cta_label, cta_url, width_units, height_units, sort_order,
     is_visible, created_at, updated_at) VALUES (${[
       card.id, card.title, card.subtitle, card.body, card.ctaLabel, card.ctaUrl, card.widthUnits, card.heightUnits,
       card.sortOrder, Boolean(card.isVisible), card.createdAt, card.updatedAt,
     ].map(sql).join(', ')});`)
}

for (const doc of builder.documents ?? []) {
  lines.push(`INSERT INTO builder_documents (doc_key, schema_version, document_json, created_at, updated_at) VALUES (${[
    doc.docKey, doc.schemaVersion ?? 1, JSON.stringify(doc), doc.updatedAt ?? now, doc.updatedAt ?? now,
  ].map(sql).join(', ')});`)
}

const pictures = []
for (const project of projects) {
  lines.push(`INSERT INTO projects (id, slug, title, summary, tech_json, demo_url, repo_url, status, publish_at, sort_order,
     created_at, updated_at, is_featured, details, links_json, detail_cards_json, content_blocks_json) VALUES (${[
       project.id, project.slug, project.title, project.summary, JSON.stringify(project.tech ?? []), project.demoUrl,
       project.repoUrl, project.status, project.publishAt, project.sortOrder, project.createdAt, project.updatedAt,
       Boolean(project.isFeatured), project.details ?? '', JSON.stringify(project.links ?? []),
       JSON.stringify(project.detailCards ?? []), JSON.stringify(project.contentBlocks ?? []),
     ].map(sql).join(', ')});`)

  for (const image of project.images ?? []) {
    const key = `projects/${project.id}/${image.id}-${safeName(image.altText)}`
    pictures.push({ path: `/api/public/images/${image.id}`, key, name: `project-${image.id}` })
    lines.push(`INSERT INTO project_images (id, project_id, r2_key, alt_text, position, created_at) VALUES (${[
      image.id, project.id, key, image.altText ?? '', image.position ?? 0, image.createdAt ?? now,
    ].map(sql).join(', ')});`)
  }
}

// The worker puts back any of its built-in projects it cannot find, as published. The live site has some of them
// hidden (drafts), so they are missing from the public list; copy them as drafts to keep them hidden here too.
// The list and the matching rule come from the worker's own code, so this stays in step with it.
const defaultsModule = join(downloads, 'default-projects.mjs')
execFileSync('./node_modules/.bin/esbuild', ['--bundle', '--format=esm', '--platform=node', '--log-level=error',
  `--outfile=${defaultsModule}`], {
  input: "export { defaultProjectSeeds } from './functions/_shared/defaultProjects'\n" +
    "export { projectIdentityMatches } from './shared/projectIdentity'\n",
  stdio: ['pipe', 'ignore', 'inherit'],
})
const { defaultProjectSeeds, projectIdentityMatches } = await import(pathToFileURL(resolve(defaultsModule)).href)
const matched = new Set()
const hiddenDefaults = defaultProjectSeeds.filter((seed) => {
  const aliases = [seed.slug, seed.title, ...(seed.aliases ?? [])]
  const project = projects.find((row) => !matched.has(row.id) && projectIdentityMatches([row.slug, row.title], aliases))
  if (project) {
    matched.add(project.id)
    return false
  }
  return true
})
let nextSort = Math.max(0, ...projects.map((project) => project.sortOrder ?? 0))
for (const seed of hiddenDefaults) {
  nextSort += 1
  lines.push(`INSERT INTO projects (slug, title, summary, tech_json, demo_url, repo_url, status, publish_at, sort_order,
     created_at, updated_at, is_featured) VALUES (${[
       seed.slug, seed.title, seed.summary, JSON.stringify(seed.tech ?? []), seed.demoUrl, seed.repoUrl, 'draft', null,
       nextSort, now, now, Boolean(seed.isFeatured),
     ].map(sql).join(', ')});`)
}

// About-page pictures are only known by the addresses the page layouts and settings point at.
const everything = JSON.stringify([settings, builder.documents])
const aboutIds = [...new Set([...everything.matchAll(/\/api\/public\/about-images\/(\d+)/g)].map((match) => Number(match[1])))]
for (const id of aboutIds) {
  const key = `about/${id}`
  pictures.push({ path: `/api/public/about-images/${id}`, key, name: `about-${id}`, aboutId: id })
}

let copiedPictures = 0
for (const picture of pictures) {
  const { file, contentType } = await download(picture.path, picture.name)
  if (picture.aboutId) {
    lines.push(`INSERT INTO about_images (id, r2_key, original_name, mime_type, created_at) VALUES (${[
      picture.aboutId, picture.key, picture.name, contentType, now,
    ].map(sql).join(', ')});`)
  }
  execFileSync(wrangler, ['r2', 'object', 'put', `nbdevlab-images/${picture.key}`, '--local', '--persist-to', state,
    '--file', file, '--content-type', contentType], { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CI: '1' } })
  copiedPictures += 1
}

const seedFile = join(downloads, 'seed.sql')
writeFileSync(seedFile, `${lines.join('\n')}\n`)
execFileSync(wrangler, ['d1', 'execute', 'nbdevlab-db', '--local', '--persist-to', state, '--file', seedFile, '--yes'], {
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, CI: '1' },
})

console.log(
  `Copied from ${LIVE}: ${projects.length} projects, ${copiedPictures} pictures, ${homeCards.length} home cards, ` +
    `${(builder.documents ?? []).length} page layouts and the site settings.` +
    (hiddenDefaults.length > 0
      ? ` Kept as drafts because the live site hides them: ${hiddenDefaults.map((seed) => seed.title).join(', ')}.`
      : ''),
)
