import { Play, Sparkles } from "lucide-react";
import { buildPriorityMessage, getDday, getTopPriorityProject } from "../services/priorityEngine";
import type { Project } from "../types";

export default function PriorityTaskCard({ projects }: { projects: Project[] }) {
  const project = getTopPriorityProject(projects);
  const dday = project ? getDday(project.deadline) : 0;

  return (
    <section className="priority-card">
      <div className="priority-copy">
        <p className="eyebrow">Today's Priority</p>
        <h2>{project?.nextTask ?? "오늘 업무 정리"}</h2>
        <p>{buildPriorityMessage(project)}</p>
        <div className="priority-stats">
          <span>긴급도 {project?.priority ?? "보통"}</span>
          <span>{project ? (dday < 0 ? `마감 ${Math.abs(dday)}일 지남` : `D-${dday}`) : "D-0"}</span>
          <span>진행률 {project?.progress ?? 0}%</span>
        </div>
      </div>
      <div className="today-checklist">
        {(project
          ? [`${project.name} ${project.nextTask} 범위 확정`, "관련 부서 산출물 확인", "완료 기준 체크"]
          : ["새 프로젝트 아이디어 정리", "완료 기록 확인", "내일 일정 준비"]
        ).map((item) => (
          <label key={item}>
            <input type="checkbox" />
            <span>{item}</span>
          </label>
        ))}
        <button className="primary-button">
          <Play size={17} />
          업무 시작하기
        </button>
      </div>
      <Sparkles className="priority-spark" size={34} />
    </section>
  );
}
