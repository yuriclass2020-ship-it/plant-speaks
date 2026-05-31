import { CheckCircle2 } from "lucide-react";
import { departments } from "../data/defaultEmployees";
import { buildPriorityMessage, getTopPriorityProject } from "../services/priorityEngine";
import { getAvatarClass } from "./EmployeeCard";
import type { ActivityLog, DepartmentId, Project, TaskReport } from "../types";

interface RightPanelProps {
  projects: Project[];
  logs: ActivityLog[];
  reports: TaskReport[];
  selectedDepartment: DepartmentId;
}

export default function RightPanel({ projects, logs, reports, selectedDepartment }: RightPanelProps) {
  const topProject = getTopPriorityProject(projects);
  const latestReport = reports[0];
  const isFirstWorkspace = projects.length === 0 && reports.length === 0 && logs.length === 0;
  const currentDepartment = departments.find((item) => item.id === selectedDepartment);
  const currentTeamResult = latestReport?.results.find((item) => item.departmentId === selectedDepartment);
  const teamNotes = currentTeamResult?.sections.flatMap((section) =>
    section.items.slice(0, 1).map((item) => `${section.title}: ${item}`),
  ) ?? [];

  return (
    <aside className="right-panel">
      <section className="mini-card sena-briefing">
        <p className="eyebrow">Sena Briefing</p>
        <h3>비서 세나의 브리핑</h3>
        <div className="briefing-row">
          <div className="sena-avatar-wrap">
            <div className={`sena-avatar-photo ${getAvatarClass("emp-sena")}`} />
            <span>세나</span>
          </div>
          <div className="sena-speech-bubble">
            <p>
              {isFirstWorkspace
                ? "대표님, 아직 비어 있어요. 프로젝트 홈에서 첫 프로젝트를 만들거나 안건 전달 탭에 한 줄만 적어주시면 제가 팀 회의를 바로 시작할게요."
                : buildPriorityMessage(topProject)}
            </p>
          </div>
        </div>
        <div className="sena-followup-stack">
          <div className="sena-speech-bubble sena-choice-bubble sena-choice-inline">
            <p>
              {isFirstWorkspace
                ? "처음엔 거창하게 적지 않아도 괜찮아요. 떠오른 아이디어 한 줄이면 충분해요."
                : "대표님, 이 중에서 하나만 먼저 고르면 다음 흐름을 제가 바로 정리해드릴게요."}
            </p>
          </div>
          <div className="sena-choice-actions">
            <h4>대표님 다음 선택</h4>
            <ul className="compact-list sena-choice-list">
              <li><CheckCircle2 size={16} /> {latestReport?.task.todayTasks[0]?.title ?? topProject?.nextTask ?? "프로젝트 홈에서 첫 프로젝트 만들기"}</li>
              <li><CheckCircle2 size={16} /> {latestReport ? "우선안 1개만 확정" : "안건 전달 탭에 첫 아이디어 한 줄 적기"}</li>
            </ul>
          </div>
        </div>
      </section>
      <section className="mini-card team-voice-card">
        <div className="team-voice-split">
          <div className="team-voice-half">
            <p className="eyebrow">Now</p>
            <h3>{currentDepartment?.name} 핵심 의견</h3>
            {teamNotes.length > 0 ? (
              <ul className="compact-list team-voice-list">
                {teamNotes.slice(0, 2).map((note) => (
                  <li key={note}><CheckCircle2 size={16} /> {note}</li>
                ))}
              </ul>
            ) : (
              <p className="recent-copy">아직 팀 회의가 시작되지 않았어요. 안건을 전달하면 세나가 팀별 의견을 모아드려요.</p>
            )}
          </div>
          <div className="team-voice-half team-voice-half-log">
            <p className="eyebrow">Recent Log</p>
            <h3>최근 기록</h3>
            {logs[0] ? (
              <p className="recent-copy">{logs[0].message}</p>
            ) : (
              <p className="recent-copy">아직 저장된 최근 기록이 없어요.</p>
            )}
          </div>
        </div>
      </section>
    </aside>
  );
}
