# Thoughts 블로그 설계

## 개요

개인 미니 블로그. Typographic하고 Simple하며 Bold한 디자인.
기술 글과 일상 글을 혼합하여 작성.

## 레퍼런스

- **Postmarks** - 타이포 중심 글 목록, 상단 메뉴 스타일
- **Rylan Phillips** - 다크 테마, 미니멀 타이포, 호버 인터랙션

---

## 기술 스택

- **Next.js 14** (App Router) + Static Export
- **TypeScript**
- **Tailwind CSS**
- **MDX** - 마크다운 + React 컴포넌트
- **react-force-graph** - 그래프 뷰 시각화

---

## 프로젝트 구조

```
/app
  /page.tsx          # 홈
  /posts/[slug]/     # 개별 글
  /archive/          # 글 목록
  /categories/       # 카테고리별 보기
  /about/            # 소개
  /graph/            # 그래프 뷰
/content
  /posts/            # 마크다운 글 파일들
/components
  /Header.tsx        # 상단 네비게이션
  /PostList.tsx      # 글 목록 컴포넌트
  /Graph.tsx         # 그래프 시각화
```

---

## 디자인 시스템

### 색상 팔레트 (다크 모드 전용)

| 용도 | 색상 |
|------|------|
| 배경 | #0A0A0A |
| 텍스트 | #FAFAFA |
| 서브텍스트 | #A1A1A1 |
| 액센트 | #FFFFFF |
| 보더 | #262626 |

### 타이포그래피

- **제목**: Cormorant (세리프)
- **본문**: Figtree (산세리프)

### 네비게이션

```
[ Home ]  [ Archive ]  [ Categories ]  [ About ]  [ Graph ]
```

- 브래킷 스타일
- 호버 시 밝기 변화

### 인터랙션

- 링크 호버: opacity 변화 또는 underline 애니메이션
- 글 목록 호버: 부드러운 하이라이트
- 페이지 전환: 심플한 fade

---

## 콘텐츠 구조

### 마크다운 Frontmatter

```yaml
---
title: "글 제목"
date: "2024-01-22"
category: "tech" | "life"
tags: ["Next.js", "블로그"]
links: ["other-post-slug"]
description: "짧은 설명"
---
```

### 글 목록 (Archive)

연도별 그룹핑, 날짜 + 제목만 심플하게:

```
2024

  01.22  글 제목이 여기에 표시됨
  01.15  또 다른 글 제목

2023

  12.28  작년의 글
```

### 카테고리

- `tech` - 기술 글
- `life` - 일상 글

---

## 그래프 뷰

### 구현

- **react-force-graph** 라이브러리 사용
- 빌드 시 마크다운의 `links` frontmatter에서 연결 데이터 추출

### 시각화

- **노드**: 각 글 (원형)
- **엣지**: links로 연결된 글들
- **노드 색상**: 카테고리별 구분 (tech: #888, life: #CCC)
- **호버**: 연결된 노드 하이라이트
- **클릭**: 해당 글로 이동

### 기능

- 드래그로 탐색
- 줌 인/아웃 지원

---

## 배포

### GitHub Pages

- `next.config.js`에서 `output: 'export'` 설정
- GitHub Actions로 자동 빌드 & 배포

### 워크플로우

1. `/content/posts/`에 마크다운 파일 작성
2. git commit & push
3. GitHub Actions 자동 실행
4. 사이트에 반영

---

## 페이지 목록

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 홈 | `/` | 최신 글 또는 소개 |
| Archive | `/archive` | 전체 글 목록 |
| Categories | `/categories` | 카테고리별 필터 |
| About | `/about` | 자기소개 |
| Graph | `/graph` | 그래프 뷰 |
| 글 상세 | `/posts/[slug]` | 개별 글 |
