import { getProjectHealth } from "../services/projectHealthEngine";
import { getDday } from "../services/priorityEngine";
import type { ActivityLog, Project } from "../types";

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onSelect?: (projectId: string) => void;
  selected?: boolean;
  recentLog?: ActivityLog;
}

export default function ProjectCard({ project, onEdit, onSelect, selected = false, recentLog }: ProjectCardProps) {
  const health = getProjectHealth(project);
  const dday = getDday(project.deadline);

  return (
    <article className={selected ? "project-card selected" : "project-card"}>
      <div className="project-topline">
        <span>{project.category}</span>
        <span className={`health health-${health.status.replace(/\s/g, "-")}`}>{health.status}</span>
      </div>
      <h3>{project.name}</h3>
      <p>{project.description || "프로젝트 설명 준비 중"}</p>
      <div className="project-meta">
        <span>{project.status}</span>
        <span>{dday < 0 ? `마감 ${Math.abs(dday)}일 지남` : `D-${dday}`}</span>
        <span>{project.priority}</span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${project.progress}%` }} />
      </div>
      <strong className="next-task">다음 업무: {project.nextTask}</strong>
      <div className="project-recent-note">
        <span className="project-recent-label">최근 반영</span>
        <p>{recentLog?.message ?? "아직 저장된 진행 기록이 없어요."}</p>
      </div>
      <small>{health.reason}</small>
      <div className="project-card-actions">
        {onSelect && (
          <button className={selected ? "ghost-button active-select" : "ghost-button"} onClick={() => onSelect(project.id)}>
            {selected ? "맥락 보는 중" : "맥락 보기"}
          </button>
        )}
        {onEdit && (
          <button className="ghost-button" onClick={() => onEdit(project)}>
            수정
          </button>
        )}
      </div>
    </article>
  );
}
