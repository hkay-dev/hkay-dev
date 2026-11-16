// Builds the signature bars from bars.yml: one dark and one light SVG per bar in
// assets/bars/, and the <picture> stack between the bars markers in README.md.
// Each bar embeds assets/icons/<name>.png, since GitHub's image proxy loads nothing
// from outside the SVG. Run: bun scripts/build-bars.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

type Bar = {
  name: string;
  tagline: string;
  url?: string;
  accent: { dark: string; light: string };
  tags: string[];
  status?: string;
};

const root = new URL('..', import.meta.url).pathname;
const bars = Bun.YAML.parse(readFileSync(root + 'bars.yml', 'utf8')) as Bar[];

const W = 840, H = 56, C = 28; // bar size; C is the bar's vertical center
const ICON = 52; // icon PNGs carry the macOS icon margin, so this draws a ~44px tile
const themes = {
  dark: { panel: '#0d1117', fg: '#e6edf3', muted: '#7d8590' },
  light: { panel: '#f6f8fa', fg: '#1f2328', muted: '#656d76' },
};
const FONT = 'ui-monospace, SFMono-Regular, &quot;SF Mono&quot;, Menlo, Consolas, &quot;Liberation Mono&quot;, monospace';
const MONO = 0.6; // monospace advance per em; textLength pins every font to it

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (x: number, y: number, size: number, s: string, attrs = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" textLength="${(s.length * size * MONO).toFixed(1)}" lengthAdjust="spacingAndGlyphs" ${attrs}>${esc(s)}</text>`;

function svg(bar: Bar, mode: keyof typeof themes) {
  const t = themes[mode], a = bar.accent[mode];
  const icon = readFileSync(`${root}assets/icons/${bar.name}.png`).toString('base64');
  const nameX = ICON + 14, nameW = bar.name.length * 16 * MONO;
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
  </g>
  <image x="4" y="${(H - ICON) / 2}" width="${ICON}" height="${ICON}" href="data:image/png;base64,${icon}"/>
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
