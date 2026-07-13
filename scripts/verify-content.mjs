import fs from "node:fs";
import path from "node:path";
import { normalizeSiteContent } from "./article-dashboard.mjs";

const root = process.cwd();
const expectedTranslationSlugs = [
  "building_ios_apps_with_ai_agents_the_practitioner_s_guide",
  "how_to_get_startup_ideas",
  "schlep_blindness",
  "stop_calling_it_memory_the_problem_with_every_ai_obsidian_tutorial",
  "the_bus_ticket_theory_of_genius",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

normalizeSiteContent(JSON.parse(read("content/site.json")));

function parseFrontmatter(file) {
  const match = file.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert(match, "translation files must have YAML frontmatter");
  const data = Object.fromEntries(
    match[1]
      .split("\n")
      .filter((line) => line.includes(":"))
      .map((line) => {
        const index = line.indexOf(":");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
  return { data, body: match[2] };
}

for (const relPath of [
  "lib/translations.ts",
  "app/translations/page.tsx",
  "app/translations/[slug]/page.tsx",
]) {
  assert(fs.existsSync(path.join(root, relPath)), `${relPath} must exist`);
}

const translationsDir = path.join(root, "content/translations");
assert(fs.existsSync(translationsDir), "content/translations must exist");
const actualSlugs = fs
  .readdirSync(translationsDir)
  .filter((fileName) => fileName.endsWith(".mdx"))
  .map((fileName) => fileName.replace(/\.mdx$/, ""))
  .sort();
assert(
  JSON.stringify(actualSlugs) === JSON.stringify([...expectedTranslationSlugs].sort()),
  `translation slugs mismatch: ${actualSlugs.join(", ")}`,
);

for (const slug of expectedTranslationSlugs) {
  const { data, body } = parseFrontmatter(read(`content/translations/${slug}.mdx`));
  for (const key of ["title", "date", "author", "source", "description"]) {
    assert(data[key], `${slug} missing ${key}`);
  }
  assert(body.trim().length > 100, `${slug} body is too short`);
}

const searchableFiles = [
  ...fs.readdirSync(path.join(root, "app"), { recursive: true }).map((file) => path.join("app", file)),
  ...fs.readdirSync(path.join(root, "components"), { recursive: true }).map((file) => path.join("components", file)),
  ...fs.readdirSync(path.join(root, "lib"), { recursive: true }).map((file) => path.join("lib", file)),
].filter((relPath) => fs.statSync(path.join(root, relPath)).isFile());

const forbidden = /Celan-Log|celan_log_pat|#admin|REPO_NAME|관리자 로그인/;
for (const relPath of searchableFiles) {
  assert(!forbidden.test(read(relPath)), `${relPath} contains old admin/Celan-Log coupling`);
}


const header = read("components/Header.tsx");
assert(!header.includes('href: "/graph"'), "Header must not expose the inactive Graph page");

const home = read("app/page.tsx");
for (const section of ["about", "expertise", "articles", "experience", "contact"]) {
  assert(home.includes(`id=\"${section}\"`), `home missing ${section} section`);
}
assert(home.includes("site.contact.email &&"), "home must hide the email link when contact.email is empty");

console.log(`verified ${actualSlugs.length} translations and no admin coupling`);
