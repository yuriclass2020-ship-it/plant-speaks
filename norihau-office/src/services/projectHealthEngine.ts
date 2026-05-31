import { getDday } from "./priorityEngine";
import type { HealthStatus, Project } from "../types";

export function getProjectHealth(project: Project): { status: HealthStatus; reason: string } {
  if (project.status === "완료") {
    return { status: "안정적", reason: "프로젝트가 완료되었습니다." };
  }

  const dday = getDday(project.deadline);
  const lastWorkedGap = Math.floor((Date.now() - new Date(project.lastWorkedAt).getTime()) / 86400000);

  if (project.delayReason || dday < 0 || (dday <= 3 && project.progress < 80)) {
    return { status: "지연 위험", reason: project.delayReason ?? "마감이 가깝거나 이미 지났습니다." };
  }

  if ((project.progress < 45 && dday <= 7) || lastWorkedGap >= 7) {
    return { status: "과부하 위험", reason: "진행률과 최근 작업 간격을 기준으로 부하가 커질 수 있습니다." };
  }

  return { status: "안정적", reason: "마감과 진행률이 현재 기준에서 안정적입니다." };
}
