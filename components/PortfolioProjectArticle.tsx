import { MDXRemote } from "next-mdx-remote/rsc";
import { PORTFOLIO_MEDIA_WIDTHS } from "@/lib/portfolio.mjs";
import type { PortfolioProject } from "@/lib/portfolio.mjs";

export default function PortfolioProjectArticle({ project }: { project: PortfolioProject }) {
  return (
    <article className="article-shell">
      <header className="mb-12">
        <p className="text-subtext text-sm mb-2">{project.period}</p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold">{project.name}</h1>
      </header>
      <div className="prose"><MDXRemote source={project.descriptionMarkdown} /></div>
      <div className="mt-12 space-y-8">
        {project.media.map((media, index) => (
          <figure
            key={`${media.src}-${index}`}
            style={{ width: PORTFOLIO_MEDIA_WIDTHS[media.size], marginInline: "auto" }}
          >
            {media.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="w-full" src={media.src} alt={media.alt} />
            ) : <video className="w-full" src={media.src} poster={media.posterSrc} controls preload="metadata" />}
            <figcaption className="text-subtext text-sm mt-2">{media.caption}</figcaption>
          </figure>
        ))}
      </div>
    </article>
  );
}
