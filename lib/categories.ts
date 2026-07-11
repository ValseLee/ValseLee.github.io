export const POST_CATEGORIES = [
  {
    id: "build-log",
    label: "Build Log",
    description: "제품과 프로젝트를 만들어 가는 기록",
    graphColor: "#595959",
  },
  {
    id: "founder-notes",
    label: "Founder Notes",
    description: "창업과 운영 과정에서 얻은 생각",
    graphColor: "#6d3f8f",
  },
  {
    id: "engineering",
    label: "Engineering",
    description: "소프트웨어 엔지니어링에 대한 글",
    graphColor: "#2f5d7c",
  },
  {
    id: "life",
    label: "Life",
    description: "일상에 대한 글",
    graphColor: "#8c6a3d",
  },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["id"];
