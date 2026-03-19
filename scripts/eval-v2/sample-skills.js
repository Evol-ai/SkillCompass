#!/usr/bin/env node
/**
 * ClawHub Skill Sampling Script
 * Stratified random sampling for SkillCompass v2 evaluation
 *
 * Tiers: T1 (Top 50), T2 (51-192), T3 (193+, from search)
 * Ratio: Dev:Non-Dev = 6:4 (27:18 of 45 total)
 */

const fs = require('fs');
const path = require('path');

// Load top 192 from explore API
const top192 = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'clawhub-top200.json'), 'utf8')
).items;

// Dev keyword patterns (in slug or summary)
const DEV_PATTERNS = [
  /\b(code|coding|dev|engineer|program|debug|test|lint|compil)/i,
  /\b(git|github|gitlab|pr-review|commit|branch|merge)/i,
  /\b(docker|kubernetes|k8s|devops|ci-cd|deploy|infra)/i,
  /\b(api|sdk|mcp|rest|graphql|grpc|webhook)/i,
  /\b(security|audit|vuln|pentest|scan)/i,
  /\b(sql|database|postgres|mysql|redis|mongo)/i,
  /\b(python|typescript|javascript|rust|golang|swift|java\b)/i,
  /\b(playwright|selenium|cypress|jest|pytest)/i,
  /\b(lsp|compiler|parser|ast|regex)/i,
  /\b(browser-automation|scraper|crawl)/i,
  /\b(filesystem|shell|terminal|tmux|cli-util)/i,
];

// Non-dev keyword patterns
const NONDEV_PATTERNS = [
  /\b(note|obsidian|notion|bear|apple-note|pkm)/i,
  /\b(weather|calendar|reminder|todo|task-manage)/i,
  /\b(music|spotify|sonos|audio|media|video|stream)/i,
  /\b(email|gmail|imap|smtp|slack|discord|telegram|imsg)/i,
  /\b(marketing|seo|content-creat|copywriting|social)/i,
  /\b(design|ui-ux|frontend-design|brand)/i,
  /\b(health|fitness|sleep|water|food|order)/i,
  /\b(smart-home|iot|hue|xiaomi|homeassistant)/i,
  /\b(finance|stock|crypto|trading|yahoo)/i,
  /\b(travel|transport|places|map)/i,
  /\b(pdf|docx|excel|ppt|document|markdown-convert)/i,
  /\b(summarize|humanize|translate|tts|whisper)/i,
  /\b(image-gen|photo|camera|visual)/i,
  /\b(productivity|focus|pomodoro)/i,
];

function classify(item) {
  const text = `${item.slug} ${item.summary || ''}`;
  let devScore = 0;
  let nondevScore = 0;
  for (const p of DEV_PATTERNS) {
    if (p.test(text)) devScore++;
  }
  for (const p of NONDEV_PATTERNS) {
    if (p.test(text)) nondevScore++;
  }
  // Tie or ambiguous → classify by summary content
  if (devScore > nondevScore) return 'dev';
  if (nondevScore > devScore) return 'non-dev';
  // Default: if it's an agent framework or general tool, classify as dev
  if (/agent|skill-creator|find-skills|evolver|proactive/i.test(text)) return 'dev';
  return 'non-dev';
}

// Classify all top 192
const classified = top192.map((item, i) => ({
  rank: i + 1,
  slug: item.slug,
  displayName: item.displayName,
  installsCurrent: item.stats.installsCurrent,
  installsAllTime: item.stats.installsAllTime,
  downloads: item.stats.downloads,
  summary: (item.summary || '').slice(0, 100),
  type: classify(item),
}));

// T3 candidates from search (skills NOT in top 192)
const top192Slugs = new Set(top192.map(i => i.slug));

const searchResults = [
  // Code review / testing
  { slug: 'pr-reviewer', summary: 'PR reviewer for code quality', type: 'dev' },
  { slug: 'clean-code-review', summary: 'Clean code review patterns', type: 'dev' },
  { slug: 'critical-code-reviewer', summary: 'Critical code reviewer', type: 'dev' },
  { slug: 'quack-code-review', summary: 'Code review with quack', type: 'dev' },
  { slug: 'explain-code', summary: 'Explain code snippets', type: 'dev' },
  // Marketing / SEO
  { slug: 'seo', summary: 'SEO site audit + content writer + competitor analysis', type: 'non-dev' },
  { slug: 'seo-competitor-analysis', summary: 'SEO intelligence & competitor analysis', type: 'non-dev' },
  { slug: 'seo-content-writer', summary: 'SEO content writer', type: 'non-dev' },
  { slug: 'ai-seo-writer', summary: 'SEO writer for AI content', type: 'non-dev' },
  { slug: 'geo-optimization', summary: 'GEO optimization', type: 'non-dev' },
  // Smart Home / IoT
  { slug: 'iot', summary: 'IoT device management', type: 'non-dev' },
  { slug: 'xiaomi-home', summary: 'Xiaomi home control', type: 'non-dev' },
  { slug: 'smart-home', summary: 'Smart home automation', type: 'non-dev' },
  { slug: 'homey-cli', summary: 'Homey home automation CLI', type: 'non-dev' },
  // Security
  { slug: 'security-audit-toolkit', summary: 'Security audit toolkit', type: 'dev' },
  { slug: 'openclaw-security-audit', summary: 'OpenClaw security audit', type: 'dev' },
  { slug: 'nodejs-security-audit', summary: 'Node.js security audit', type: 'dev' },
  { slug: 'agentic-security-audit', summary: 'Agentic security audit', type: 'dev' },
  // Data / Analytics
  { slug: 'python-dataviz', summary: 'Python data visualization', type: 'dev' },
  { slug: 'data-anomaly-detector', summary: 'Data anomaly detection', type: 'dev' },
  { slug: 'data-visualization-2', summary: 'Data visualization tool', type: 'non-dev' },
  // Design / UX
  { slug: 'ui-ux-design', summary: 'UI/UX design guide', type: 'non-dev' },
  { slug: 'designer', summary: 'Designer skill', type: 'non-dev' },
  { slug: 'shadcn-ui', summary: 'Shadcn UI components', type: 'dev' },
  // DevOps
  { slug: 'devops', summary: 'DevOps automation', type: 'dev' },
  { slug: 'docker', summary: 'Docker management', type: 'dev' },
  { slug: 'kubectl', summary: 'Kubernetes kubectl', type: 'dev' },
  { slug: 'docker-compose', summary: 'Docker Compose management', type: 'dev' },
  { slug: 'k8s', summary: 'Kubernetes management', type: 'dev' },
  // Productivity
  { slug: 'focus-deep-work', summary: 'Focus and deep work', type: 'non-dev' },
  { slug: 'pkm', summary: 'Personal knowledge base', type: 'non-dev' },
  { slug: 'personal-notes', summary: 'Personal notes management', type: 'non-dev' },
  { slug: 'meetings', summary: 'Meeting management', type: 'non-dev' },
].filter(s => !top192Slugs.has(s.slug)).map(s => ({
  ...s,
  rank: '200+',
  installsCurrent: '<73',
  installsAllTime: 'N/A',
  downloads: 'N/A',
}));

// Sampling function
function stratifiedSample(pool, devCount, nondevCount, seed) {
  const devPool = pool.filter(i => i.type === 'dev');
  const nondevPool = pool.filter(i => i.type === 'non-dev');

  // Seeded pseudo-random (deterministic)
  let s = seed;
  function rand() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  }

  function pick(arr, n) {
    const shuffled = [...arr].sort(() => rand() - 0.5);
    return shuffled.slice(0, n);
  }

  return {
    dev: pick(devPool, Math.min(devCount, devPool.length)),
    nondev: pick(nondevPool, Math.min(nondevCount, nondevPool.length)),
  };
}

// Split into tiers
const t1Pool = classified.filter(i => i.rank <= 50);
const t2Pool = classified.filter(i => i.rank > 50 && i.rank <= 192);
const t3Pool = searchResults;

console.log('=== Pool Stats ===');
console.log(`T1 (Top 50):  ${t1Pool.length} total | ${t1Pool.filter(i=>i.type==='dev').length} dev | ${t1Pool.filter(i=>i.type==='non-dev').length} non-dev`);
console.log(`T2 (51-192):  ${t2Pool.length} total | ${t2Pool.filter(i=>i.type==='dev').length} dev | ${t2Pool.filter(i=>i.type==='non-dev').length} non-dev`);
console.log(`T3 (200+):    ${t3Pool.length} total | ${t3Pool.filter(i=>i.type==='dev').length} dev | ${t3Pool.filter(i=>i.type==='non-dev').length} non-dev`);
console.log('');

// Sample: T1=5 (3d+2nd), T2=15 (9d+6nd), T3=25 (15d+10nd)
const SEED = 20260314; // today's date as seed for reproducibility
const t1 = stratifiedSample(t1Pool, 3, 2, SEED);
const t2 = stratifiedSample(t2Pool, 9, 6, SEED + 1);
const t3 = stratifiedSample(t3Pool, 15, 10, SEED + 2);

function printTier(name, tier) {
  const all = [...tier.dev, ...tier.nondev].sort((a, b) => {
    const ra = typeof a.rank === 'number' ? a.rank : 999;
    const rb = typeof b.rank === 'number' ? b.rank : 999;
    return ra - rb;
  });
  console.log(`\n=== ${name} (${all.length} skills) ===`);
  console.log('Rank | Slug                              | Installs | Type    | Summary');
  console.log('-----|-----------------------------------|----------|---------|--------');
  all.forEach(item => {
    const rank = String(item.rank).padStart(4);
    const slug = item.slug.padEnd(35);
    const inst = String(item.installsCurrent).padStart(8);
    const type = item.type.padEnd(7);
    const sum = (item.summary || '').slice(0, 45);
    console.log(`${rank} | ${slug} | ${inst} | ${type} | ${sum}`);
  });
}

printTier('T1: Top 50 (5 samples)', t1);
printTier('T2: Rank 51-192 (15 samples)', t2);
printTier('T3: Rank 200+ (25 samples)', t3);

// Output final sample as JSON
const finalSample = [
  ...t1.dev.map(i => ({ ...i, tier: 'T1' })),
  ...t1.nondev.map(i => ({ ...i, tier: 'T1' })),
  ...t2.dev.map(i => ({ ...i, tier: 'T2' })),
  ...t2.nondev.map(i => ({ ...i, tier: 'T2' })),
  ...t3.dev.map(i => ({ ...i, tier: 'T3' })),
  ...t3.nondev.map(i => ({ ...i, tier: 'T3' })),
];

console.log(`\n=== TOTAL: ${finalSample.length} skills ===`);
console.log(`Dev: ${finalSample.filter(i=>i.type==='dev').length} | Non-Dev: ${finalSample.filter(i=>i.type==='non-dev').length}`);

// Save to file
fs.writeFileSync(
  path.join(__dirname, '..', 'skills-sample.json'),
  JSON.stringify(finalSample, null, 2),
  'utf8'
);
console.log('\nSaved to skills-sample.json');
