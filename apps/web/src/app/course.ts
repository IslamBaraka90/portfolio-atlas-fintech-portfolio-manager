// The course map drives the navigation rail, breadcrumbs and progress. Titles are
// also the accessible link names that browser journeys use; keep them stable.
export interface CourseChapter {
  id: number;
  title: string;
  hash: string;
}
export interface CoursePart {
  title: string;
  chapters: CourseChapter[];
}

export const courseParts: CoursePart[] = [
  {
    title: "Foundations",
    chapters: [
      { id: 1, title: "Mandate lab", hash: "#mandates" },
      { id: 2, title: "Instrument discovery", hash: "#instruments" },
      { id: 3, title: "Candle quality", hash: "#market-data" },
      { id: 4, title: "Actions & currency", hash: "#actions" },
    ],
  },
  {
    title: "Book and analysis",
    chapters: [
      { id: 5, title: "Portfolio book", hash: "#book" },
      { id: 6, title: "Value & benchmark", hash: "#valuation" },
      { id: 7, title: "Research & evidence", hash: "#research" },
      { id: 8, title: "Risk & assumptions", hash: "#risk" },
    ],
  },
  {
    title: "Decisions",
    chapters: [
      { id: 9, title: "Construction & targets", hash: "#construction" },
      { id: 10, title: "Causal validation", hash: "#validation" },
      { id: 11, title: "Rebalance review", hash: "#rebalancing" },
      { id: 12, title: "Paper execution", hash: "#orders" },
    ],
  },
  {
    title: "Operations",
    chapters: [
      { id: 13, title: "Custody & reconciliation", hash: "#operations" },
      { id: 14, title: "Monitoring & alerts", hash: "#monitoring" },
      { id: 15, title: "Performance & attribution", hash: "#performance" },
      { id: 16, title: "Management reports", hash: "#reports" },
      { id: 17, title: "Governance & recovery", hash: "#governance" },
    ],
  },
  {
    title: "Live desk",
    chapters: [
      { id: 18, title: "Live runtime", hash: "#live" },
      { id: 19, title: "Live quotes", hash: "#quotes" },
      { id: 20, title: "Live history", hash: "#bars" },
      { id: 21, title: "Live FX", hash: "#fx" },
      { id: 22, title: "Live portfolio", hash: "#live-portfolio" },
    ],
  },
];

export const courseChapters = courseParts.flatMap((part) => part.chapters);

export function locateChapter(id: number) {
  const part = courseParts.find((item) => item.chapters.some((chapter) => chapter.id === id));
  const chapter = courseChapters.find((item) => item.id === id);
  return { part, chapter };
}
