import { useState } from "react";
import TaskResultReport from "../components/TaskResultReport";
import type { ActivityLog, Project, TaskReport } from "../types";

interface RecordsPageProps {
  logs: ActivityLog[];
  reports: TaskReport[];
  projects: Project[];
}

export default function RecordsPage({ logs, reports, projects }: RecordsPageProps) {
  const [activeTab, setActiveTab] = useState<"done" | "logs" | "report" | "projects">("logs");
  const completedProjects = projects.filter((project) => project.status === "완료");
  const latestLog = logs[0];
  const latestReport = reports[0];

  return (
    <div className="records-layout">
      <section className="panel project-home-panel">
        <div className="project-home-head">
          <div>
            <p className="eyebrow">Meeting Archive</p>
            <h2>회의 기록</h2>
          </div>
          <div className="studio-tab-list compact-tabs" role="tablist" aria-label="회의 기록 탭">
            <button className={activeTab === "done" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("done")}>
              완료 업무
            </button>
            <button className={activeTab === "logs" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("logs")}>
              활동 로그
            </button>
            <button className={activeTab === "report" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("report")}>
              보고서
            </button>
            <button className={activeTab === "projects" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("projects")}>
              프로젝트 기록
            </button>
          </div>
        </div>

        <div className="finance-summary-grid archive-summary-grid">
          <article className="finance-summary-card">
            <span>최근 활동</span>
            <strong>{latestLog ? "업데이트 있음" : "기록 전"}</strong>
            <p>{latestLog ? latestLog.message : "아직 저장된 활동 로그가 없어요."}</p>
          </article>
          <article className="finance-summary-card">
            <span>완료 프로젝트</span>
            <strong>{completedProjects.length}건</strong>
            <p>{completedProjects.length > 0 ? `${completedProjects[0].name} 외 기록이 남아 있어요.` : "완료 처리된 프로젝트가 아직 없어요."}</p>
          </article>
          <article className="finance-summary-card">
            <span>최근 보고서</span>
            <strong>{latestReport ? latestReport.task.projectName : "보고서 없음"}</strong>
            <p>{latestReport ? "가장 최근 팀 결과 보고서를 열어볼 수 있어요." : "아직 생성된 업무 보고서가 없어요."}</p>
          </article>
        </div>
      </section>

      {activeTab === "done" && (
        <section className="panel archive-detail-panel">
          <div className="project-desk-section-head">
            <h3>최근 완료 업무</h3>
            <span>마무리된 프로젝트만 모아서 확인할 수 있어요.</span>
          </div>
          <div className="record-list">
            {completedProjects.map((project) => (
                <article key={project.id}>
                  <strong>{project.name}</strong>
                  <span>{project.nextTask}</span>
                </article>
              ))}
            {completedProjects.length === 0 && <p>아직 완료 처리된 프로젝트가 없습니다.</p>}
          </div>
        </section>
      )}

      {activeTab === "logs" && (
        <section className="panel archive-detail-panel">
          <div className="project-desk-section-head">
            <h3>팀별 활동 로그</h3>
            <span>최근에 어떤 결정과 작업이 있었는지 시간순으로 봐요.</span>
          </div>
          <ul className="timeline-list">
            {logs.map((log) => (
              <li key={log.id}>
                <span>{new Date(log.createdAt).toLocaleString("ko-KR")}</span>
                <strong>{log.message}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === "report" && (
        <TaskResultReport report={reports[0]} />
      )}

      {activeTab === "projects" && (
        <section className="panel archive-detail-panel">
          <div className="project-desk-section-head">
            <h3>프로젝트별 업무 기록</h3>
            <span>프로젝트별 현재 상태와 다음 업무를 한 번에 확인해요.</span>
          </div>
          <div className="record-list">
            {projects.map((project) => (
              <article key={project.id}>
                <strong>{project.name}</strong>
                <span>{project.status} · {project.progress}% · {project.nextTask}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
