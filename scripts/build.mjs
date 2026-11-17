// Renders index.md (the single source of truth) into a human-facing page.
//
//   index.md   -> _site/index.md    raw Markdown, for agents
//              -> _site/index.html  the same content as styled HTML, for people
//              -> _site/llms.txt    a pointer telling crawlers where the Markdown is
//
// The rendered Markdown is real text in the HTML body, so an agent that lands
// on the HTML page still reads everything; the <link rel="alternate"> tells it
// where the cleaner Markdown copy lives.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "_site");
const SITE = "https://jonathanda1.github.io";

const md = readFileSync(join(root, "index.md"), "utf8").replace(/\r\n/g, "\n");

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (s) => s.replace(/[*_`]/g, "").replace(/<([^>]+)>/g, "$1").trim();

const title = strip(md.match(/^# (.+)$/m)?.[1] ?? "Profile");
const summary = strip(md.match(/^> (.+)$/m)?.[1] ?? "");
const updated = md.match(/Last updated:\s*([0-9-]+)/)?.[1] ?? "";

// GitHub-style heading ids so in-page links like (#contact) work.
const slugs = new Map();
const slug = (text) => {
  const base = text.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");
  const n = slugs.get(base) ?? 0;
  slugs.set(base, n + 1);
  return n ? `${base}-${n}` : base;
};
marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${slug(text)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    table(token) {
      // Wrap tables so they scroll sideways on phones instead of the page.
      return `<div class="table-wrap">${marked.Renderer.prototype.table.call(this, token)}</div>\n`;
    },
  },
});

const body = marked.parse(md);

const html = readFileSync(join(root, "site/template.html"), "utf8")
  .replaceAll("{{title}}", escape(title))
  .replaceAll("{{summary}}", escape(summary))
  .replaceAll("{{updated}}", escape(updated))
  .replaceAll("{{site}}", SITE)
  .replace("{{content}}", () => body);

const llms = `# ${title}

> ${summary}

This site is a personal profile written for AI agents. The canonical,
machine-readable version is plain Markdown:

- [${title} — profile](${SITE}/index.md): career history, selected work, skills, and contact. Read the rules at the top of the file before using it.
`;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "index.html"), html);
writeFileSync(join(out, "index.md"), md);
writeFileSync(join(out, "llms.txt"), llms);
writeFileSync(join(out, ".nojekyll"), "");
copyFileSync(join(root, "site/style.css"), join(out, "style.css"));
copyFileSync(join(root, "site/favicon.svg"), join(out, "favicon.svg"));

console.log(`Built _site/ — "${title}", last updated ${updated || "unknown"}`);
