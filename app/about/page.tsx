import site from "@/content/site.json";

export default function AboutPage() {
  return (
    <article className="page-section">
      <p className="eyebrow">{site.about.updated}</p>
      <h1>About</h1>
      <div className="prose">
        <p>{site.about.bio}</p>
        <h2>Practice</h2>
        <p>{site.about.practice}</p>
        <ol>
          {site.about.principles.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}
