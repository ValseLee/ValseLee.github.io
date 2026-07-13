# Developer Blog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the static blog with the approved editorial portfolio layout and extend the existing localhost-only dashboard to edit every public profile section.

**Architecture:** The deployed Next.js app remains a static export and reads profile data from one tracked `content/site.json` file plus the existing MDX posts. The existing Node dashboard remains bound to `127.0.0.1`, gains validated atomic reads/writes for the JSON file, and exposes no deployed Admin route.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Node.js built-ins, MDX, `node:test`

## Global Constraints

- Preserve GitHub Pages-compatible `output: "export"` and every existing public route.
- Keep Admin local-only on `127.0.0.1`; do not create `/admin` or a deployed write API.
- Use one `content/site.json` file for identity, about, expertise, experience, and contact content.
- Show at most the first 10 sentences of each post on the home page instead of images.
- Do not add dependencies, image upload, authentication, a database, external CMS, analytics, comments, search, or newsletter features.
- Do not copy the reference site's code or proprietary assets.
- Preserve keyboard focus, responsive layout, and `prefers-reduced-motion` behavior.

---

## File Map

- Create `content/site.json`: tracked source of all editable profile content.
- Create `lib/post-excerpt.ts`: Markdown-to-plain-text sentence preview helper.
- Create `lib/post-excerpt.test.ts`: direct `node:test` coverage for the 10-sentence rule.
- Modify `lib/posts.ts`: include post content-derived excerpts in list metadata.
- Modify `scripts/article-dashboard.mjs`: validate/load/atomically save site content and render its local editor.
- Modify `scripts/article-dashboard.test.mjs`: cover valid save, invalid input, and preservation on failure.
- Modify `scripts/verify-content.mjs`: reject malformed `content/site.json` during builds.
- Modify `package.json`: add the excerpt test command and one aggregate test command.
- Modify `app/page.tsx`: render the six-section editorial home page.
- Modify `app/layout.tsx`: widen the shell and provide site-specific metadata from `content/site.json`.
- Modify `app/globals.css`: define the light editorial visual system and responsive layout.
- Modify `components/Header.tsx`: use compact numbered navigation matching the new visual language.
- Modify `app/about/page.tsx`: render the editable About content rather than duplicate hard-coded copy.
- Modify existing archive, category, translation, and post pages only where class changes are needed for the shared layout.

---

### Task 1: Editable Site Content Storage

**Files:**
- Create: `content/site.json`
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**
- Produces: `normalizeSiteContent(raw): SiteContent`
- Produces: `loadSiteContent(root?: string): SiteContent`
- Produces: `saveSiteContent(raw, root?: string): { ok: true; filePath: "content/site.json"; content: SiteContent }`
- `SiteContent` shape: `{ identity, about, expertise, experience, contact }` exactly as represented in `content/site.json`.

- [ ] **Step 1: Write failing dashboard tests**

Add imports for `loadSiteContent`, `normalizeSiteContent`, and `saveSiteContent`, then add:

```js
test("site content is normalized and saved atomically", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-content-"));
  const content = {
    identity: { name: "Celan", role: "Software Engineer / Writer", title: "Celan builds systems and writes about them.", intro: "개발과 제품에 관한 기록입니다." },
    about: { updated: "2026.07", bio: "복잡한 문제를 단순한 시스템으로 만듭니다.", practice: "소프트웨어와 AI 도구를 연구합니다.", principles: ["Build small.", "Write clearly."] },
    expertise: [{ label: "Engineering", items: ["AI Systems", "Web Platforms"] }],
    experience: [{ period: "2024 — Now", organization: "Independent", role: "Software Engineer", description: "제품과 개발 도구를 만듭니다." }],
    contact: { email: "hello@example.com", socials: [{ label: "GitHub", url: "https://github.com/example" }], copyright: "© 2026 Celan" },
  };

  const result = saveSiteContent(content, root);
  assert.equal(result.filePath, path.join("content", "site.json"));
  assert.deepEqual(loadSiteContent(root), content);
  assert.equal(fs.existsSync(path.join(root, "content", ".site.json.tmp")), false);
});

test("invalid site content never replaces the existing file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-content-invalid-"));
  fs.mkdirSync(path.join(root, "content"), { recursive: true });
  const file = path.join(root, "content", "site.json");
  fs.writeFileSync(file, '{"existing":true}\n');

  assert.throws(
    () => saveSiteContent({ identity: { name: "" } }, root),
    /identity\.name/,
  );
  assert.equal(fs.readFileSync(file, "utf8"), '{"existing":true}\n');
});

test("site content rejects unsafe social URLs", () => {
  assert.throws(
    () => normalizeSiteContent({
      identity: { name: "Celan", role: "Developer", title: "Title", intro: "Intro" },
      about: { updated: "Now", bio: "Bio", practice: "Practice", principles: ["One"] },
      expertise: [{ label: "Engineering", items: ["Web"] }],
      experience: [{ period: "Now", organization: "Studio", role: "Developer", description: "Work" }],
      contact: { email: "hello@example.com", socials: [{ label: "Bad", url: "javascript:alert(1)" }], copyright: "© Celan" },
    }),
    /https URL/,
  );
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm run test:article-dashboard`

Expected: FAIL because the three site-content functions are not exported.

- [ ] **Step 3: Add the initial tracked content file**

Create `content/site.json`:

```json
{
  "identity": {
    "name": "Celan",
    "role": "Software Engineer / Writer",
    "title": "Celan builds systems and writes about them.",
    "intro": "AI, software architecture, products, and the work of turning complicated ideas into useful systems."
  },
  "about": {
    "updated": "Updated Jul. 2026",
    "bio": "소프트웨어를 만들고, 그 과정에서 발견한 생각을 기록합니다. 복잡한 문제를 작고 분명한 시스템으로 바꾸는 일에 관심이 있습니다.",
    "practice": "AI 에이전트, 소프트웨어 아키텍처, 제품 개발의 접점을 탐구합니다. 실험하고 구축한 뒤, 배운 것을 다시 글로 정리합니다.",
    "principles": ["Build the smallest useful thing.", "Make decisions visible.", "Write to sharpen the work."]
  },
  "expertise": [
    { "label": "Engineering", "items": ["AI Systems", "Software Architecture", "Web Platforms"] },
    { "label": "Product", "items": ["Prototyping", "Developer Experience", "Technical Strategy"] },
    { "label": "Writing", "items": ["Build Logs", "Engineering Essays", "Translations"] }
  ],
  "experience": [
    { "period": "Now", "organization": "Independent", "role": "Software Engineer / Writer", "description": "Building software systems and documenting the decisions behind them." }
  ],
  "contact": {
    "email": "hello@example.com",
    "socials": [{ "label": "GitHub", "url": "https://github.com/ValseLee" }],
    "copyright": "© 2026 Celan. Built as a static archive."
  }
}
```

- [ ] **Step 4: Implement validation and atomic persistence**

Add to `scripts/article-dashboard.mjs` near the existing input helpers:

```js
function requiredString(value, field) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${field} 값을 입력해 주세요.`);
  return result;
}

export function normalizeSiteContent(raw) {
  if (!raw || typeof raw !== "object") throw new Error("사이트 콘텐츠 형식이 올바르지 않습니다.");
  const stringArray = (value, field) => {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} 배열이 비어 있습니다.`);
    if (value.length > 20) throw new Error(`${field} 항목은 20개 이하여야 합니다.`);
    return value.map((item, index) => requiredString(item, `${field}[${index}]`));
  };

  const socials = Array.isArray(raw.contact?.socials) ? raw.contact.socials.map((social, index) => {
    const url = requiredString(social?.url, `contact.socials[${index}].url`);
    if (!/^https:\/\//.test(url)) throw new Error(`contact.socials[${index}].url은 https URL이어야 합니다.`);
    return { label: requiredString(social?.label, `contact.socials[${index}].label`), url };
  }) : [];
  if (socials.length > 20) throw new Error("contact.socials 항목은 20개 이하여야 합니다.");

  const expertise = (Array.isArray(raw.expertise) ? raw.expertise : []).map((group, index) => ({
    label: requiredString(group?.label, `expertise[${index}].label`),
    items: stringArray(group?.items, `expertise[${index}].items`),
  }));
  if (expertise.length === 0 || expertise.length > 20) throw new Error("expertise 항목은 1개 이상 20개 이하여야 합니다.");

  const experience = (Array.isArray(raw.experience) ? raw.experience : []).map((item, index) => ({
    period: requiredString(item?.period, `experience[${index}].period`),
    organization: requiredString(item?.organization, `experience[${index}].organization`),
    role: requiredString(item?.role, `experience[${index}].role`),
    description: requiredString(item?.description, `experience[${index}].description`),
  }));
  if (experience.length === 0 || experience.length > 20) throw new Error("experience 항목은 1개 이상 20개 이하여야 합니다.");

  const email = requiredString(raw.contact?.email, "contact.email");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("contact.email 형식이 올바르지 않습니다.");

  return {
    identity: {
      name: requiredString(raw.identity?.name, "identity.name"),
      role: requiredString(raw.identity?.role, "identity.role"),
      title: requiredString(raw.identity?.title, "identity.title"),
      intro: requiredString(raw.identity?.intro, "identity.intro"),
    },
    about: {
      updated: requiredString(raw.about?.updated, "about.updated"),
      bio: requiredString(raw.about?.bio, "about.bio"),
      practice: requiredString(raw.about?.practice, "about.practice"),
      principles: stringArray(raw.about?.principles, "about.principles"),
    },
    expertise,
    experience,
    contact: {
      email,
      socials,
      copyright: requiredString(raw.contact?.copyright, "contact.copyright"),
    },
  };
}

export function loadSiteContent(root = process.cwd()) {
  return normalizeSiteContent(JSON.parse(fs.readFileSync(path.join(root, "content", "site.json"), "utf8")));
}

export function saveSiteContent(raw, root = process.cwd()) {
  const content = normalizeSiteContent(raw);
  const directory = path.join(root, "content");
  const filePath = path.join(directory, "site.json");
  const temporaryPath = path.join(directory, ".site.json.tmp");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, filePath);
  return { ok: true, filePath: path.join("content", "site.json"), content };
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:article-dashboard`

Expected: 12 tests pass, 0 fail.

```bash
git add content/site.json scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "feat: add editable site content storage"
```

---

### Task 2: Ten-Sentence Post Excerpts

**Files:**
- Create: `lib/post-excerpt.ts`
- Create: `lib/post-excerpt.test.ts`
- Modify: `lib/posts.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `createPostExcerpt(markdown: string, maxSentences?: number): string`
- Changes `PostMeta` to include `excerpt: string`.

- [ ] **Step 1: Write the failing excerpt test**

Create `lib/post-excerpt.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { createPostExcerpt } from "./post-excerpt.ts";

test("createPostExcerpt strips Markdown and keeps at most ten sentences", () => {
  const markdown = `# 제목

첫 문장입니다. **둘째 문장입니다.** [셋째 문장입니다.](https://example.com)

\`\`\`ts
const hidden = "미리보기에 포함하지 않습니다.";
\`\`\`

넷째입니다. 다섯째입니다. 여섯째입니다. 일곱째입니다. 여덟째입니다. 아홉째입니다. 열째입니다. 열한째입니다.`;
  const excerpt = createPostExcerpt(markdown);

  assert.equal(excerpt.includes("const hidden"), false);
  assert.equal(excerpt.includes("**"), false);
  assert.equal(excerpt.includes("열한째"), false);
  assert.equal(excerpt, "제목 첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다. 넷째입니다. 다섯째입니다. 여섯째입니다. 일곱째입니다. 여덟째입니다. 아홉째입니다. 열째입니다.");
});
```

Add to `package.json`:

```json
"test:post-excerpt": "node --test lib/post-excerpt.test.ts",
"test": "npm run test:article-dashboard && npm run test:post-excerpt"
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm run test:post-excerpt`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/post-excerpt.ts`.

- [ ] **Step 3: Implement the native sentence segmenter**

Create `lib/post-excerpt.ts`:

```ts
export function createPostExcerpt(markdown: string, maxSentences = 10): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`#>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain || maxSentences < 1) return "";
  return [...new Intl.Segmenter("ko", { granularity: "sentence" }).segment(plain)]
    .slice(0, maxSentences)
    .map(({ segment }) => segment.trim())
    .join(" ");
}
```

- [ ] **Step 4: Feed excerpts through `getAllPosts`**

In `lib/posts.ts`, import the helper, add `excerpt: string` to `PostMeta`, parse both `data` and `content` in `getAllPosts`, and return:

```ts
return {
  slug,
  frontmatter: data as PostFrontmatter,
  excerpt: createPostExcerpt(content),
};
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: all dashboard and excerpt tests pass.

```bash
git add lib/post-excerpt.ts lib/post-excerpt.test.ts lib/posts.ts package.json package-lock.json
git commit -m "feat: add post sentence excerpts"
```

---

### Task 3: Editorial Home and Shared Visual System

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/Header.tsx`
- Modify: `app/about/page.tsx`

**Interfaces:**
- Consumes: `content/site.json` and `PostMeta.excerpt` from Tasks 1–2.
- Produces: responsive Hero, About, Expertise, Articles, Experience, and Contact sections.

- [ ] **Step 1: Add a build-level failing assertion**

Extend `scripts/verify-content.mjs` temporarily with:

```js
const home = read("app/page.tsx");
for (const section of ["about", "expertise", "articles", "experience", "contact"]) {
  assert(home.includes(`id=\"${section}\"`), `home missing ${section} section`);
}
```

Run: `npm run verify:content`

Expected: FAIL with `home missing about section`.

- [ ] **Step 2: Replace the narrow dark shell**

In `app/layout.tsx`, keep `Figtree`, remove `Cormorant`, import `site` from `@/content/site.json`, set metadata from `site.identity`, and render:

```tsx
<html lang="ko">
  <body className={`${figtree.variable} antialiased`}>
    <div className="site-shell">
      <Header />
      <main>{children}</main>
    </div>
  </body>
</html>
```

In `app/globals.css`, replace the dark tokens with `--background: #f2f1ed`, `--foreground: #0a0a0a`, `--subtext: #55534f`, `--border: #b7b4ad`, and add these stable layout classes:

```css
.site-shell { width:min(100%, 1600px); margin:0 auto; padding:0 clamp(18px, 2.8vw, 44px); }
.display-title { font-size:clamp(4rem, 10.5vw, 10.5rem); font-weight:600; line-height:.78; letter-spacing:-.075em; }
.section-grid { display:grid; grid-template-columns:repeat(12, minmax(0, 1fr)); gap:clamp(18px, 2.4vw, 38px); border-top:1px solid var(--border); padding:32px 0 96px; }
.section-number { grid-column:span 3; font-size:clamp(5rem, 10vw, 9rem); line-height:.8; letter-spacing:-.06em; }
.section-content { grid-column:span 9; }
.eyebrow { font-size:.72rem; font-weight:600; letter-spacing:.08em; text-transform:uppercase; }
.focus-ring:focus-visible, a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible { outline:2px solid var(--foreground); outline-offset:4px; }
@media (max-width: 760px) { .section-number, .section-content { grid-column:1 / -1; } .display-title { line-height:.86; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior:auto !important; transition:none !important; } }
```

Retain the existing `.prose` rules but update them to the new tokens and sans-serif headings.

- [ ] **Step 3: Build the six home sections**

Replace `app/page.tsx` with a server component that imports `site`, calls `getAllPosts()`, and renders:

```tsx
import Link from "next/link";
import site from "@/content/site.json";
import { getAllPosts } from "@/lib/posts";

const formatDate = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value));

export default function Home() {
  const posts = getAllPosts();

  return (
<>
  <section className="hero-grid" aria-labelledby="home-title">
    <p className="eyebrow">{site.identity.name} · {site.identity.role}</p>
    <h1 id="home-title" className="display-title">{site.identity.title}</h1>
    <p className="hero-intro">{site.identity.intro}</p>
  </section>
  <section id="about" className="section-grid">
    <div className="section-number">1</div>
    <div className="section-content two-column-copy">
      <div><p className="eyebrow">{site.about.updated}</p><h2>About</h2><p>{site.about.bio}</p></div>
      <div><h3>Practice</h3><p>{site.about.practice}</p><ol>{site.about.principles.map((principle) => <li key={principle}>{principle}</li>)}</ol></div>
    </div>
  </section>
  <section id="expertise" className="section-grid">
    <div className="section-number">2</div>
    <div className="section-content expertise-grid">
      {site.expertise.map((group) => <div key={group.label}><h2>{group.label}</h2><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
    </div>
  </section>
  <section id="articles" className="section-grid">
    <div className="section-number">3</div>
    <div className="section-content article-grid">
      {posts.map((post) => (
        <article key={post.slug} className="article-card">
          <p className="eyebrow">{formatDate(post.frontmatter.date)} · {post.frontmatter.category}</p>
          <h2><Link href={`/posts/${post.slug}`}>{post.frontmatter.title}</Link></h2>
          <p>{post.excerpt}</p>
          <ul className="tag-list">{post.frontmatter.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
        </article>
      ))}
    </div>
  </section>
  <section id="experience" className="section-grid">
    <div className="section-number">4</div>
    <div className="section-content experience-list">
      {site.experience.map((item) => <article key={`${item.period}-${item.organization}`}><p className="eyebrow">{item.period}</p><h2>{item.organization}</h2><h3>{item.role}</h3><p>{item.description}</p></article>)}
    </div>
  </section>
  <section id="contact" className="section-grid">
    <div className="section-number">5</div>
    <div className="section-content contact-grid">
      <div><p className="eyebrow">Contact</p><a className="contact-link" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></div>
      <ul>{site.contact.socials.map((social) => <li key={social.url}><a href={social.url} target="_blank" rel="noreferrer">{social.label} ↗</a></li>)}</ul>
      <p>{site.contact.copyright}</p>
    </div>
  </section>
</>
  );
}
```

- [ ] **Step 4: Update shared navigation and About**

Change `Header` navigation to Home, Articles (`/#articles`), Archive, Categories, Translations, and About. Prefix visible items with two-digit indices and keep `usePathname()` only for active-page state. In `app/about/page.tsx`, import `site` and render `site.about.bio`, `site.about.practice`, and `site.about.principles` rather than hard-coded text.

- [ ] **Step 5: Build and commit**

Run: `npm run verify:content && npm run build`

Expected: static export succeeds and all existing routes remain in the route table.

```bash
git add app/page.tsx app/layout.tsx app/globals.css app/about/page.tsx components/Header.tsx scripts/verify-content.mjs
git commit -m "feat: redesign blog as editorial portfolio"
```

---

### Task 4: Local Full-Site Admin

**Files:**
- Modify: `scripts/article-dashboard.mjs`
- Modify: `scripts/article-dashboard.test.mjs`

**Interfaces:**
- Consumes: `loadSiteContent()` and `saveSiteContent()` from Task 1.
- Produces: `GET /api/site` and `POST /api/site`, available only on the existing localhost dashboard server.

- [ ] **Step 1: Add endpoint-level behavior tests**

Export `createServer`, start it on an ephemeral local port in the test, and assert:

```js
test("local dashboard reads and writes site content", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-dashboard-api-"));
  fs.mkdirSync(path.join(root, "content"), { recursive: true });
  saveSiteContent(validSiteContent(), root);
  const server = createServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const { port } = server.address();

  const loaded = await fetch(`http://127.0.0.1:${port}/api/site`).then((response) => response.json());
  assert.equal(loaded.ok, true);
  loaded.content.identity.title = "Updated title";
  const saved = await fetch(`http://127.0.0.1:${port}/api/site`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(loaded.content),
  }).then((response) => response.json());
  assert.equal(saved.content.identity.title, "Updated title");
  assert.equal(loadSiteContent(root).identity.title, "Updated title");
});
```

Define `validSiteContent()` once in the test file with the complete valid shape from Task 1.

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm run test:article-dashboard`

Expected: FAIL because `createServer` is not exported and `/api/site` does not exist.

- [ ] **Step 3: Add the two local API routes**

Export `createServer` and add before the 404 response:

```js
if (request.method === "GET" && url.pathname === "/api/site") {
  try { sendJson(response, 200, { ok: true, content: loadSiteContent(root) }); }
  catch (error) { sendJson(response, 500, { ok: false, error: error.message }); }
  return;
}

if (request.method === "POST" && url.pathname === "/api/site") {
  try { sendJson(response, 200, saveSiteContent(await readJsonBody(request), root)); }
  catch (error) { sendJson(response, 400, { ok: false, error: error.message }); }
  return;
}
```

- [ ] **Step 4: Add the site editor to the existing dashboard HTML**

Add two top-level buttons, `Article` and `Site content`, that toggle the existing article grid and a new `#site-editor`. The site form must contain native text inputs/textareas for scalar values and row containers for repeating structures:

```html
<div id="site-principles" class="repeat-list"></div><button type="button" data-add="principles" class="secondary">원칙 추가</button>
<div id="site-expertise" class="repeat-list"></div><button type="button" data-add="expertise" class="secondary">전문 분야 추가</button>
<div id="site-experience" class="repeat-list"></div><button type="button" data-add="experience" class="secondary">경력 추가</button>
<div id="site-socials" class="repeat-list"></div><button type="button" data-add="socials" class="secondary">소셜 링크 추가</button>
```

Use one in-memory `siteContent` object. `loadSiteEditor()` fetches `/api/site`, fills scalar controls, and calls `renderRepeatList()` for each array. The generic renderer uses these exact field definitions:

```js
const repeatDefinitions = {
  principles: { container: "#site-principles", fields: ["value"] },
  expertise: { container: "#site-expertise", fields: ["label", "items"] },
  experience: { container: "#site-experience", fields: ["period", "organization", "role", "description"] },
  socials: { container: "#site-socials", fields: ["label", "url"] },
};

function repeatValues(key) {
  if (key === "principles") return siteContent.about.principles.map((value) => ({ value }));
  if (key === "socials") return siteContent.contact.socials;
  return siteContent[key];
}

function renderRepeatList(key) {
  const definition = repeatDefinitions[key];
  const container = document.querySelector(definition.container);
  container.replaceChildren(...repeatValues(key).map((item, index) => {
    const row = document.createElement("div");
    row.className = "repeat-row";
    for (const field of definition.fields) {
      const input = document.createElement(field === "description" || field === "items" ? "textarea" : "input");
      input.value = field === "items" ? item.items.join("\n") : item[field];
      input.dataset.repeatKey = key;
      input.dataset.repeatIndex = String(index);
      input.dataset.repeatField = field;
      row.append(input);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary";
    remove.textContent = "삭제";
    remove.dataset.remove = key;
    remove.dataset.index = String(index);
    row.append(remove);
    return row;
  }));
}
```

Add the exact defaults and delegated handlers:

```js
const repeatDefaults = {
  principles: "",
  expertise: { label: "", items: [] },
  experience: { period: "", organization: "", role: "", description: "" },
  socials: { label: "", url: "https://" },
};

function targetArray(key) {
  if (key === "principles") return siteContent.about.principles;
  if (key === "socials") return siteContent.contact.socials;
  return siteContent[key];
}

document.querySelector("#site-editor").addEventListener("input", (event) => {
  const { repeatKey, repeatIndex, repeatField } = event.target.dataset;
  if (!repeatKey) return;
  const index = Number(repeatIndex);
  if (repeatKey === "principles") siteContent.about.principles[index] = event.target.value;
  else targetArray(repeatKey)[index][repeatField] = repeatField === "items"
    ? event.target.value.split("\n").map((value) => value.trim()).filter(Boolean)
    : event.target.value;
});

document.querySelector("#site-editor").addEventListener("click", (event) => {
  const addKey = event.target.dataset.add;
  const removeKey = event.target.dataset.remove;
  if (addKey) {
    targetArray(addKey).push(structuredClone(repeatDefaults[addKey]));
    renderRepeatList(addKey);
  }
  if (removeKey) {
    targetArray(removeKey).splice(Number(event.target.dataset.index), 1);
    renderRepeatList(removeKey);
  }
});
```

`collectSitePayload()` copies scalar controls into `siteContent`; the site form submits it to `POST /api/site` and reports the server message in `#site-status`. No drag-and-drop, rich text editor, or client framework is added.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:article-dashboard`

Expected: all tests pass and the server closes cleanly.

```bash
git add scripts/article-dashboard.mjs scripts/article-dashboard.test.mjs
git commit -m "feat: edit full site content locally"
```

---

### Task 5: Content Verification and Browser QA

**Files:**
- Modify: `scripts/verify-content.mjs`
- Modify only if QA exposes a defect: `app/globals.css`, `app/page.tsx`, `components/Header.tsx`, `scripts/article-dashboard.mjs`

**Interfaces:**
- Consumes all earlier public and local interfaces.
- Produces a verified static build and a verified localhost editing flow.

- [ ] **Step 1: Make content verification cover the site JSON**

Add a `JSON.parse(read("content/site.json"))` check to `scripts/verify-content.mjs` and assert every required scalar is a non-empty string, expertise and experience are non-empty arrays, and every social URL starts with `https://`. Keep the existing translation and admin-coupling checks.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
npm test
npm run verify:content
npm run lint
npm run build
```

Expected: every command exits 0; build output includes `/`, `/about`, `/archive`, `/categories`, `/graph`, `/posts/[slug]`, `/translations`, and `/translations/[slug]`.

- [ ] **Step 3: Verify the public site in a browser**

Run `npm run dev`, open the printed localhost URL, and check:

- Desktop: hero fills the opening viewport; numbered sections align to the grid; every article shows no more than 10 sentences.
- Mobile at 390 px: no horizontal overflow; section numbers stack above content; navigation remains keyboard and touch accessible.
- Article detail and About: readable line length, visible focus, working back/navigation links.
- Browser console: no errors.

- [ ] **Step 4: Verify the local editor without changing tracked content**

Copy the worktree to a temporary directory, run `npm run write` there, open `http://127.0.0.1:4317`, load the Site content tab, change the title, save, and confirm only the temporary copy's `content/site.json` changed. Confirm invalid JSON leaves the file unchanged and shows an error.

- [ ] **Step 5: Final commit**

If QA required fixes:

```bash
git add scripts/verify-content.mjs app/globals.css app/page.tsx components/Header.tsx scripts/article-dashboard.mjs
git commit -m "fix: polish developer blog verification"
```

If no QA fix was needed:

```bash
git add scripts/verify-content.mjs
git commit -m "test: verify editable site content"
```
