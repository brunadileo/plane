/**
 * Fork feature (docs/2026-10-11-description-tabs.md): splits a work item description into tabs.
 * Pure string logic with no DOM and no imports, so `node --test tests/` can run it on the host.
 */

export type TDescriptionSection = {
  /** Tab label. */
  name: string;
  /** Section HTML without its heading. */
  html: string;
  /** True for the always-last How to Test tab. */
  isTest: boolean;
  /** How to Test tab with no matching section in the description. */
  isEmpty: boolean;
  /** Rest of a test heading after "How to test" / "Your test", e.g. "(iPhone, 2 min)". */
  meta: string;
};

export type TSplitDescription = {
  /** HTML above the first heading. */
  intro: string;
  sections: TDescriptionSection[];
};

type TNode = { html: string; tag: string | null; inner: string };

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "wbr",
]);
const TAG_RE = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const TEST_RE = /^(how to test|your test)/i;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };

export const NO_TEST_STEPS_TEXT = 'No test steps yet. Add a "How to test" heading in Edit.';

const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();

/** Splits an HTML string into its top-level nodes (elements with their children, and bare text). */
function topLevelNodes(html: string): TNode[] {
  const nodes: TNode[] = [];
  let depth = 0;
  let start = 0;
  let openTag: string | null = null;
  let openEnd = 0;
  let last = 0;
  const flushText = (end: number) => {
    const text = html.slice(last, end);
    if (text.trim()) nodes.push({ html: text, tag: null, inner: text });
  };
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(html))) {
    if (m[0].startsWith("<!--")) continue;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const selfClosing = VOID_TAGS.has(tag) || m[3].trimEnd().endsWith("/");
    if (closing) {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && openTag) {
        nodes.push({ html: html.slice(start, TAG_RE.lastIndex), tag: openTag, inner: html.slice(openEnd, m.index) });
        openTag = null;
        last = TAG_RE.lastIndex;
      }
    } else if (selfClosing) {
      if (depth === 0) {
        flushText(m.index);
        nodes.push({ html: m[0], tag, inner: "" });
        last = TAG_RE.lastIndex;
      }
    } else {
      if (depth === 0) {
        flushText(m.index);
        start = m.index;
        openTag = tag;
        openEnd = TAG_RE.lastIndex;
      }
      depth++;
    }
  }
  if (openTag) nodes.push({ html: html.slice(start), tag: openTag, inner: html.slice(openEnd) });
  else flushText(html.length);
  return nodes;
}

/** True when the description has no text and no media (upstream shows its editor with the placeholder). */
/** True when both descriptions read the same as plain text (markup and whitespace ignored). */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  const words = (html: string | null | undefined) => textOf(html ?? "").replace(/\s+/g, "");
  return words(a) === words(b);
}

export function isEmptyDescription(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<(img|image-component|issue-embed-component|iframe|hr|table)\b/i.test(html)) return false;
  return textOf(html) === "";
}

/**
 * Splits at the biggest heading level present at the top level (h1, else h2, else h3).
 * A section whose heading starts with "How to test" or "Your test" becomes the last tab;
 * without one, the last tab is an empty How to Test tab. Empty input gives no sections.
 */
export function splitDescription(html: string | null | undefined): TSplitDescription {
  if (isEmptyDescription(html)) return { intro: "", sections: [] };

  let nodes = topLevelNodes(html as string);
  // the fetched HTML is often wrapped in one <div>
  while (nodes.length === 1 && nodes[0].tag === "div") nodes = topLevelNodes(nodes[0].inner);

  const level = ["h1", "h2", "h3"].find((h) => nodes.some((n) => n.tag === h)) ?? null;
  const intro: string[] = [];
  const found: { name: string; body: string[] }[] = [];
  for (const node of nodes) {
    if (level && node.tag === level) found.push({ name: textOf(node.inner) || "Untitled", body: [] });
    else if (found.length) found[found.length - 1].body.push(node.html);
    else intro.push(node.html);
  }

  const sections: TDescriptionSection[] = [];
  const testAt = found.findIndex((s) => TEST_RE.test(s.name));
  found.forEach((s, i) => {
    if (i !== testAt) sections.push({ name: s.name, html: s.body.join(""), isTest: false, isEmpty: false, meta: "" });
  });
  if (testAt >= 0) {
    const test = found[testAt];
    sections.push({
      name: "How to Test",
      html: test.body.join(""),
      isTest: true,
      isEmpty: false,
      meta: test.name.replace(TEST_RE, "").trim(),
    });
  } else {
    sections.push({ name: "How to Test", html: "", isTest: true, isEmpty: true, meta: "" });
  }
  return { intro: intro.join("").trim(), sections };
}

/** Cards in the Testing state open on the How to Test tab (always the last one), every other card on the first. */
export function openingTabIndex(sectionCount: number, stateName: string | undefined): number {
  return stateName === "Testing" && sectionCount > 0 ? sectionCount - 1 : 0;
}
