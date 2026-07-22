import Link from "next/link";
import site from "@/content/site";
import { getAllPosts } from "@/lib/posts";
import { formatTranslationDate, getAllTranslations } from "@/lib/translations";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

export default function Home() {
  const posts = getAllPosts();
  const translations = getAllTranslations().slice(0, 5);

  return (
    <>
      <section className="hero-grid" aria-labelledby="home-title">
        <h1 id="home-title" className="display-title">
          {site.identity.title}
        </h1>
      </section>

      <section id="about" className="section-grid">
        <div className="section-number" aria-hidden="true">
          1
        </div>
        <div className="section-content two-column-copy">
          <div>
            <p className="eyebrow">{site.about.updated}</p>
            <h2>About</h2>
            <p>{site.about.bio}</p>
          </div>
          <div>
            <h3>Practice</h3>
            <p>{site.about.practice}</p>
            <ol>
              {site.about.principles.map((principle) => (
                <li key={principle}>{principle}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="expertise" className="section-grid">
        <div className="section-number" aria-hidden="true">
          2
        </div>
        <div className="section-content expertise-grid">
          {site.expertise.map((group) => (
            <div key={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="articles" className="section-grid">
        <div className="section-number" aria-hidden="true">
          3
          <h4>아티클</h4>
          <Link className="view-all" href="/archive" aria-label="아티클 전체보기">
            전체보기
          </Link>
        </div>
        <div className="section-content article-grid">
          {posts.map((post) => (
            <article key={post.slug} className="article-card">
              <p className="eyebrow">
                {formatDate(post.frontmatter.date)} · {post.frontmatter.category}
              </p>
              <h2>
                <Link href={`/posts/${post.slug}`}>{post.frontmatter.title}</Link>
              </h2>
              <p>{post.excerpt}</p>
              <ul className="tag-list">
                {post.frontmatter.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="experience" className="section-grid">
        <div className="section-number" aria-hidden="true">
          4
          <h4>이력</h4>
        </div>
        <div className="section-content experience-list">
          {site.experience.map((item) => (
            <article key={`${item.period}-${item.organization}`}>
              <div>
                <h2>{item.organization}</h2>
                <h3>{item.role}</h3>
                <p className="eyebrow">{item.period}</p>
              </div>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="section-grid">
        <div className="section-number" aria-hidden="true">
          5
        </div>
        <div className="section-content contact-grid">
          <div>
            <p className="eyebrow">Translations</p>
            <ul>
              {translations.map((translation) => (
                <li key={translation.slug}>
                  <Link href={`/translations/${translation.slug}`}>
                    {translation.frontmatter.title}
                  </Link>
                  <p>
                    {translation.frontmatter.author}
                    {translation.frontmatter.date &&
                      ` · ${formatTranslationDate(translation.frontmatter.date)}`}
                  </p>
                </li>
              ))}
            </ul>
            <Link className="view-all" href="/translations" aria-label="번역 전체보기">
              전체보기
            </Link>

          </div>
          <div>
            <p className="eyebrow">Contact</p>
            {site.contact.email && (
              <a className="contact-link" href={`mailto:${site.contact.email}`}>
                {site.contact.email}
              </a>
            )}

            <ul className="contact-link-list">
              {site.contact.socials.map((social) => (
                <li key={social.url}>
                  <a href={social.url} target="_blank" rel="noreferrer">
                    {social.label} ↗
                  </a>
                </li>
              ))}
            </ul>

          </div>
          <p>{site.contact.copyright}</p>
        </div>
      </section>
    </>
  );
}
