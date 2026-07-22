import { MDXRemote } from "next-mdx-remote/rsc";
import type { PortfolioProject } from "@/lib/portfolio.mjs";

export default function PortfolioProjectArticle({ project }: { project: PortfolioProject }) {
  return (
    <article className="w-full max-w-[75vw] mx-auto py-12">
      <header className="mb-12">
        <p className="text-subtext text-sm mb-2">{project.period}</p>
        <h1 className="font-serif text-4xl md:text-5xl font-semibold">{project.name}</h1>
      </header>
      <div className="prose"><MDXRemote source={project.descriptionMarkdown} /></div>
      <div className="mt-12 space-y-8">
        {project.media.map((media, index) => (
          <figure key={`${media.src}-${index}`}>
            {media.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.src} alt={media.alt} />
            ) : <video src={media.src} controls preload="metadata" />}
            <figcaption className="text-subtext text-sm mt-2">{media.caption}</figcaption>
          </figure>
        ))}
      </div>
    </article>
  );
}
