import { notFound } from "next/navigation";
import PortfolioProjectArticle from "@/components/PortfolioProjectArticle";
import { getAllPortfolioProjects, getPortfolioProjectBySlug } from "@/lib/portfolio-content.mjs";

interface PortfolioPageProps { params: Promise<{ slug: string }> }
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPortfolioProjects().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PortfolioPageProps) {
  const project = getPortfolioProjectBySlug((await params).slug);
  if (!project) return { title: "Not Found" };
  return { title: `${project.name} | Portfolio`, description: `${project.name} · ${project.period}` };
}

export default async function PortfolioPage({ params }: PortfolioPageProps) {
  const project = getPortfolioProjectBySlug((await params).slug);
  if (!project) notFound();
  return <PortfolioProjectArticle project={project} />;
}
