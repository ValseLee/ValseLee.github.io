export const POST_CATEGORIES = [
  {
    id: "build-log",
    label: "Build Log",
    description: "제품과 프로젝트를 만들어 가는 기록",
    graphColor: "#8B949E",
  },
  {
    id: "founder-notes",
    label: "Founder Notes",
    description: "창업과 운영 과정에서 얻은 생각",
    graphColor: "#D2A8FF",
  },
  {
    id: "engineering",
    label: "Engineering",
    description: "소프트웨어 엔지니어링에 대한 글",
    graphColor: "#79C0FF",
  },
  {
    id: "life",
    label: "Life",
    description: "일상에 대한 글",
    graphColor: "#CCCCCC",
  },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["id"];
