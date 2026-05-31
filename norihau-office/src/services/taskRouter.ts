import type { DepartmentId, Project, ProjectPriority, RoutedTask, TaskItem } from "../types";

const departmentKeywords: Record<DepartmentId, string[]> = {
  secretary: [],
  content: ["놀이", "프로젝트", "활동", "유아", "관찰기록", "알림장", "상담", "문서"],
  design: ["디자인", "화면", "아이콘", "카드뉴스", "canva", "Canva"],
  development: ["개발", "코드", "오류", "기능", "앱", "React", "react"],
  marketing: ["인스타", "릴스", "홍보", "브랜드", "캡션"],
  finance: ["비용", "수익", "구독", "가격", "판매"],
};

const typeKeywords = [
  { type: "교육 콘텐츠 기획", words: ["놀이", "활동", "유아", "프로젝트"] },
  { type: "교사 문서 작성", words: ["관찰기록", "알림장", "상담", "문서"] },
  { type: "디자인 구성", words: ["디자인", "화면", "아이콘", "카드뉴스", "Canva"] },
  { type: "개발 기능 요청", words: ["개발", "코드", "오류", "기능", "앱", "React"] },
  { type: "홍보 콘텐츠 작성", words: ["인스타", "릴스", "홍보", "브랜드", "캡션"] },
  { type: "재무 계산", words: ["비용", "수익", "구독", "가격", "판매"] },
];

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function detectDepartments(command: string): DepartmentId[] {
  const found = Object.entries(departmentKeywords)
    .filter(([, words]) => includesAny(command, words))
    .map(([departmentId]) => departmentId as DepartmentId);

  return found.length > 0 ? Array.from(new Set(["secretary", ...found])) : ["secretary", "content"];
}

function detectTaskType(command: string) {
  return typeKeywords.find((group) => includesAny(command, group.words))?.type ?? "복합 업무";
}

function detectProject(command: string, projects: Project[], projectIdOverride?: string) {
  if (projectIdOverride) {
    return projects.find((project) => project.id === projectIdOverride);
  }
  return projects.find((project) => command.includes(project.name));
}

function detectUrgency(project?: Project): ProjectPriority {
  if (!project) return "보통";
  if (project.priority === "긴급") return "긴급";
  const dday = Math.ceil((new Date(project.deadline).getTime() - Date.now()) / 86400000);
  if (dday < 0 || (dday <= 3 && project.progress < 80)) return "긴급";
  if (dday <= 7) return "높음";
  return project.priority;
}

function makeTodayTasks(type: string, projectName: string): TaskItem[] {
  return [
    { id: crypto.randomUUID(), title: `${projectName} 요구사항을 한 문장으로 정리하기`, done: false },
    { id: crypto.randomUUID(), title: `${type}에 필요한 산출물 3개 확정하기`, done: false },
    { id: crypto.randomUUID(), title: "담당 부서 결과를 보고서로 검토하기", done: false },
  ];
}

export function routeTask(
  command: string,
  projects: Project[],
  options?: { sourceInboxId?: string; projectIdOverride?: string },
): RoutedTask {
  const project = detectProject(command, projects, options?.projectIdOverride);
  const taskType = detectTaskType(command);
  const projectName = project?.name ?? "신규 프로젝트";
  const assignedDepartments = detectDepartments(command);

  return {
    id: crypto.randomUUID(),
    command,
    sourceInboxId: options?.sourceInboxId,
    projectId: project?.id,
    projectName,
    taskType,
    assignedDepartments,
    todayTasks: makeTodayTasks(taskType, projectName),
    urgency: detectUrgency(project),
    createdAt: new Date().toISOString(),
    summary: `세나가 '${projectName}' 업무를 '${taskType}' 유형으로 분석하고 관련 부서에 배정했습니다.`,
  };
}
