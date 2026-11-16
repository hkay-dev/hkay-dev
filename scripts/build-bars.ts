// Builds the signature bars from bars.yml: one dark and one light SVG per bar in
// assets/bars/, and the <picture> stack between the bars markers in README.md.
// Run: bun scripts/build-bars.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

type Bar = {
  name: string;
  tagline: string;
  url?: string;
  motif: keyof typeof motifs;
  accent: { dark: string; light: string };
  tags: string[];
  status?: string;
};

const root = new URL('..', import.meta.url).pathname;
const bars = Bun.YAML.parse(readFileSync(root + 'bars.yml', 'utf8')) as Bar[];

const W = 840, H = 56, C = 28; // bar size; C is the motif tile's center
const themes = {
  dark: { panel: '#0d1117', fg: '#e6edf3', muted: '#7d8590' },
  light: { panel: '#f6f8fa', fg: '#1f2328', muted: '#656d76' },
};
const FONT = 'ui-monospace, SFMono-Regular, &quot;SF Mono&quot;, Menlo, Consolas, &quot;Liberation Mono&quot;, monospace';
const MONO = 0.6; // monospace advance per em; textLength pins every font to it

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (x: number, y: number, size: number, s: string, attrs = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" textLength="${(s.length * size * MONO).toFixed(1)}" lengthAdjust="spacingAndGlyphs" ${attrs}>${esc(s)}</text>`;

// Each motif is one small movement inside the 56px tile, drawn in the accent color.
const motifs = {
  zap: (a: string) => `
    <path d="M31 13 L19 30 H27 L24 43 L37 25 H29 Z" fill="${a}">
      <animate attributeName="opacity" values="1;1;0.2;1;0.35;1;1" keyTimes="0;0.8;0.83;0.86;0.89;0.92;1" dur="5s" repeatCount="indefinite"/>
    </path>`,
  fan: (a: string, t: typeof themes.dark) => `
    <circle cx="${C}" cy="${C}" r="17" fill="none" stroke="${a}" stroke-opacity="0.35" stroke-width="1.5"/>
    <g fill="${a}">
      ${[0, 120, 240].map((r) => `<path d="M28 28 C25 21 28 13 33 14 C38 15 35 23 28 28 Z" transform="rotate(${r} 28 28)"/>`).join('')}
      <animateTransform attributeName="transform" type="rotate" from="0 28 28" to="360 28 28" dur="2.4s" repeatCount="indefinite"/>
    </g>
    <circle cx="${C}" cy="${C}" r="3" fill="${t.panel}" stroke="${a}" stroke-width="1.5"/>`,
  radial: (a: string) => `
    <circle cx="${C}" cy="${C}" r="15" fill="none" stroke="${a}" stroke-opacity="0.4" stroke-width="1.5"/>
    ${[0, 60, 120, 180, 240, 300].map((r) => `<circle cx="28" cy="13" r="2.2" fill="${a}" fill-opacity="0.45" transform="rotate(${r} 28 28)"/>`).join('')}
    <g>
      <line x1="28" y1="28" x2="28" y2="16" stroke="${a}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="28" cy="13" r="3.4" fill="${a}"/>
      <animateTransform attributeName="transform" type="rotate" values="0 28 28;60 28 28;60 28 28;180 28 28;180 28 28;300 28 28;300 28 28;360 28 28" keyTimes="0;0.08;0.3;0.38;0.6;0.68;0.9;1" dur="4.5s" repeatCount="indefinite"/>
    </g>
    <circle cx="${C}" cy="${C}" r="2.5" fill="${a}"/>`,
  stash: (a: string) => `
    <path d="M14 30 V41 H42 V30" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="18" y="35" width="20" height="3.5" rx="1.5" fill="${a}"/>
    <rect x="18" y="30" width="20" height="3.5" rx="1.5" fill="${a}" fill-opacity="0.55"/>
    <rect x="18" y="12" width="20" height="3.5" rx="1.5" fill="${a}" opacity="0">
      <animate attributeName="y" values="12;12;25;25" keyTimes="0;0.25;0.55;1" dur="3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.25;0.8;1" dur="3s" repeatCount="indefinite"/>
    </rect>`,
};

function svg(bar: Bar, mode: keyof typeof themes) {
  const t = themes[mode], a = bar.accent[mode];
  const nameX = 74, nameW = bar.name.length * 16 * MONO;
  const tagX = nameX + nameW + 14;
  const tagEnd = tagX + bar.tagline.length * 13 * MONO;

  // Chips run right to left from the bar's right edge; the status chip is filled.
  const chips = [...bar.tags.map((s) => ({ s, solid: false })), ...(bar.status ? [{ s: bar.status, solid: true }] : [])];
  let x = W - 14, chipSvg = '';
  for (const { s, solid } of chips.reverse()) {
    const w = s.length * 10.5 * MONO + 16;
    x -= w;
    chipSvg += `<rect x="${x}" y="${C - 10}" width="${w}" height="20" rx="10" fill="${solid ? a : 'none'}" stroke="${a}" stroke-opacity="${solid ? 1 : 0.5}"/>`;
    chipSvg += text(x + 8, C + 4, 10.5, s, `fill="${solid ? t.panel : a}" font-weight="700"`);
    x -= 6;
  }
  if (tagEnd > x - 12) throw new Error(`${bar.name}: tagline runs into the tags; shorten one of them`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(bar.name)}: ${esc(bar.tagline)}">
  <defs>
    <clipPath id="shape"><rect width="${W}" height="${H}" rx="10"/></clipPath>
    <linearGradient id="wash" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="${a}" stop-opacity="0.16"/>
      <stop offset="0.6" stop-color="${a}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <style>text { font-family: ${FONT}; }</style>
  <g clip-path="url(#shape)">
    <rect width="${W}" height="${H}" fill="${t.panel}"/>
    <rect width="${W}" height="${H}" fill="url(#wash)"/>
    <rect width="${H}" height="${H}" fill="${a}" fill-opacity="0.14"/>
    <line x1="${H}" y1="0" x2="${H}" y2="${H}" stroke="${a}" stroke-opacity="0.35"/>
    ${motifs[bar.motif](a, t)}
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="none" stroke="${a}" stroke-opacity="0.45"/>
  ${text(nameX, C + 6, 16, bar.name, `fill="${t.fg}" font-weight="700"`)}
  ${text(tagX, C + 5, 13, bar.tagline, `fill="${t.muted}"`)}
  ${chipSvg}
</svg>
`;
}

mkdirSync(root + 'assets/bars', { recursive: true });
const html = bars.map((bar) => {
  for (const mode of ['dark', 'light'] as const) writeFileSync(`${root}assets/bars/${bar.name}-${mode}.svg`, svg(bar, mode));
  const pic = `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/bars/${bar.name}-dark.svg"><img alt="${esc(bar.name)}: ${esc(bar.tagline)}" src="assets/bars/${bar.name}-light.svg" width="100%"></picture>`;
  return bar.url ? `<a href="${bar.url}">${pic}</a>` : pic;
}).join('\n');

const readme = readFileSync(root + 'README.md', 'utf8');
const marked = /<!-- bars:start -->[\s\S]*<!-- bars:end -->/;
if (!marked.test(readme)) throw new Error('README.md has no <!-- bars:start --> ... <!-- bars:end --> block');
writeFileSync(root + 'README.md', readme.replace(marked, `<!-- bars:start -->\n${html}\n<!-- bars:end -->`));
console.log(`built ${bars.length} bars`);
