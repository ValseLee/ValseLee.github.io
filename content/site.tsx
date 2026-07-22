const site = {
  identity: {
    name: "Celan",
    role: "iOS Product Engineer",
    titleText: "iOS Product Engineer | Celan",
    title: ["안녕하세요,", "iOS Product Engineer", "이승준 입니다."],
    intro: "2년 이상 Swift/UIKit/SwiftUI 기반 iOS 애플리케이션을 개발·출시·운영하고, 제품 기획과 팀 협업을 통해 서비스 완성도와 사용자 지표를 개선해 왔습니다.",
  },
  about: {
    updated: "Updated Jul. 2026",
    bio: (
      <>
        임팩트 주도형 iOS Product Engineer, 이승준입니다. <br /> 제품 기획부터 몰입형 UI 개발까지, 서비스 개발의 전 영역에 적극 참여하고 팀의 성장을 주도합니다.
      </>
    ),
    practice: (
      <>
        AI 에이전트를 활용하여 소프트웨어 서비스를 개발하고, 방법론을 연구합니다. <br />
        배운 것을 다시 글로 정리하며 지식을 공유하는 데에 관심이 많습니다.
      </>
    ),
    principles: ["Build the smallest useful thing.", "Make decisions visible.", "Write to sharpen the work."],
  },
  expertise: [
    { label: "Engineering", items: ["AI Systems", "iOS Software Architecture", "React"] },
    { label: "Product", items: ["Prototyping", "Developer Experience", "Technical Strategy"] },
    { label: "Writing", items: ["Engineering Essays", "Translations", "Life"] },
  ],
  experience: [
    {
      period: "2025.08.11. - 2025.11.10.(3개월)",
      organization: "주식회사 피트크루",
      role: "iOS Lead Product Engineer",
      description: (
        <>
          - iOS 첫 출시
          <br />- SQLite 기반 로컬 데이터베이스
          <br />- 복약 스케줄링 엔진과 테스트 환경 구축
          <br />- 주간 QA 시간 단축
        </>
      ),
    },
    {
      period: "2024.04.14. - 2025.08.03.(1년 5개월)",
      organization: "주식회사 제제미미",
      role: "iOS Developer / Subscription OKR Lead",
      description: (
        <>
          - 쑥쑥찰칵 고화질 영상 업로드 구독 정책·상품 기획
          <br />- US, JP Localization 기반 작업
          <br />- 2024년 5월 대비 2025년 5월 MAU 20% 이상 향상
          <br />- Advertisement Banner render delay 2배 이상 개선
        </>
      ),
    },
    {
      period: "2026.06.19. - 2026.07.31.(8주)",
      organization: (<>AT Kearney<br />전남광주통합특별시</>),
      role: "Web Frontend(Freelance)",
      description: (
        <>
          - React·TypeScript 기반 웹 프론트엔드
          <br />- 19개 산업단지 투자유치 디지털 브로슈어
          <br />- 모바일 반응형 화면 구현
        </>
      ),
    },
    {
      period: "2026.02.02. - Present",
      organization: "Personal Open Source",
      role: "RPI Workflow Developer",
      description: (
        <>
          - Brownfield 프로젝트를 위한 AI Workflow
          <br />- AI 코딩 어시스턴트 Context Window 관리
          <br />- Claude Code Plugin 개발·배포
        </>
      ),
    },
  ],
  contact: {
    email: "sollleky72@gmail.com",
    socials: [
      { label: "GitHub", url: "https://github.com/ValseLee" },
      { label: "LinkedIn", url: "www.linkedin.com/in/celanlee" },
    ],
    copyright: "© 2026 Celan. Built as a static archive.",
  },
};

export default site;
