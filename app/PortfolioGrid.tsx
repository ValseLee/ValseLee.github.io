import Link from "next/link";
import type { PortfolioProject } from "@/lib/portfolio.mjs";
import styles from "./PortfolioGrid.module.css";

export default function PortfolioGrid({ projects }: { projects: PortfolioProject[] }) {
  return (
    <div className={`section-content ${styles.grid}`}>
      {projects.map((project) => (
        <Link key={project.slug} className={styles.card} href={`/portfolio/${project.slug}`}>
          {project.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.cover} src={project.coverImage.src} alt={project.coverImage.alt} />
          )}
          <span className={styles.overlay}>
            <span className={styles.name}>{project.name}</span>
            <span className={styles.period}>{project.period}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
