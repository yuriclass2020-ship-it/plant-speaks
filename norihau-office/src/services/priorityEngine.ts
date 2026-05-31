import type { Project } from "../types";

const DAY = 86400000;

export function getDday(deadline: string) {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / DAY);
}

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / DAY);
}

export function getPriorityScore(project: Project) {
  if (project.status === "완료") return -Infinity;
  if (project.priority === "긴급") return 1000;

  const dday = getDday(project.deadline);
  const overdueScore = dday < 0 ? 500 + Math.abs(dday) * 10 : 0;
  const deadlineScore = Math.max(0, 30 - dday) * 8;
  const progressRisk = project.progress < 50 && dday <= 7 ? 140 : 0;
  const staleScore = Math.max(0, daysSince(project.lastWorkedAt) - 3) * 12;
  const manualPriority = project.priority === "높음" ? 80 : project.priority === "보통" ? 30 : 0;

  return overdueScore + deadlineScore + progressRisk + staleScore + manualPriority;
}

export function getTopPriorityProject(projects: Project[]) {
  return [...projects]
    .filter((project) => project.status !== "완료")
    .sort((a, b) => getPriorityScore(b) - getPriorityScore(a))[0];
}

export function buildPriorityMessage(project?: Project) {
  if (!project) return "대표님, 오늘은 완료되지 않은 프로젝트가 없습니다. 기록 정리와 다음 아이디어 수집을 추천드려요.";

  const dday = getDday(project.deadline);
  const dueText = dday < 0 ? `마감이 ${Math.abs(dday)}일 지났고` : `마감 D-${dday}이고`;
  const riskText = project.progress < 50 ? "진행률이 낮아 빠른 정리가 필요해요." : "남은 단계가 명확해 마무리하기 좋습니다.";

  return `대표님, 오늘은 '${project.name}' ${project.nextTask}을 우선 추천드려요. ${dueText} ${project.status} 단계라 ${riskText}`;
}
