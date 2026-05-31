import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import ProjectCard from "../components/ProjectCard";
import type { ActivityLog, Project, ProjectPriority, ProjectStatus, TaskReport } from "../types";

const emptyProject: Project = {
  id: "",
  name: "",
  description: "",
  category: "교육콘텐츠",
  status: "기획 중",
  progress: 0,
  deadline: new Date().toISOString().slice(0, 10),
  priority: "보통",
  nextTask: "",
  lastWorkedAt: new Date().toISOString().slice(0, 10),
};

interface ProjectsPageProps {
  projects: Project[];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  addLog: (message: string, type: ActivityLog["type"]) => void;
  logs: ActivityLog[];
  reports: TaskReport[];
}

export default function ProjectsPage({ projects, setProjects, addLog, logs, reports }: ProjectsPageProps) {
  const [form, setForm] = useState<Project>(emptyProject);
  const [activeTab, setActiveTab] = useState<"active" | "all" | "desk">("active");
  const [showDetails, setShowDetails] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const resetProjectForm = () => {
    setForm({ ...emptyProject, deadline: new Date().toISOString().slice(0, 10), lastWorkedAt: new Date().toISOString().slice(0, 10) });
    setShowDetails(false);
  };

  const saveProject = () => {
    if (!form.name.trim()) return;
    const project = { ...form, id: form.id || crypto.randomUUID() };
    setProjects((current) => {
      const exists = current.some((item) => item.id === project.id);
      return exists ? current.map((item) => (item.id === project.id ? project : item)) : [project, ...current];
    });
    addLog(`${project.name} 프로젝트가 저장되었습니다.`, "project");
    resetProjectForm();
    setActiveTab("active");
  };

  const visibleProjects = projects.filter((project) => (
    activeTab === "active" ? project.status !== "완료" && project.status !== "보류" : true
  ));

  useEffect(() => {
    if (activeTab === "desk") return;
    if (visibleProjects.length === 0) {
      setSelectedProjectId("");
      return;
    }
    if (!visibleProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(visibleProjects[0].id);
    }
  }, [activeTab, selectedProjectId, visibleProjects]);

  const openEditDesk = (project: Project) => {
    setForm(project);
    setShowDetails(true);
    setActiveTab("desk");
  };

  const selectedProject = useMemo(
    () => visibleProjects.find((project) => project.id === selectedProjectId) ?? visibleProjects[0],
    [selectedProjectId, visibleProjects],
  );

  const selectedProjectReports = useMemo(() => {
    if (!selectedProject) return [];
    return reports.filter((report) => (
      report.task.projectId === selectedProject.id || report.task.projectName === selectedProject.name
    ));
  }, [reports, selectedProject]);

  const selectedProjectLogs = useMemo(() => {
    if (!selectedProject) return [];
    return logs.filter((log) => log.message.includes(selectedProject.name));
  }, [logs, selectedProject]);

  const projectTimeline = useMemo(() => {
    if (!selectedProject) return [];

    const reportEntries = selectedProjectReports.map((report) => ({
      id: `report-${report.id}`,
      createdAt: report.createdAt,
      label: "업무 지시",
      title: report.task.command,
      detail: report.task.summary,
    }));

    const logEntries = selectedProjectLogs.map((log) => ({
      id: `log-${log.id}`,
      createdAt: log.createdAt,
      label: "진행 기록",
      title: log.message,
      detail: new Date(log.createdAt).toLocaleString("ko-KR"),
    }));

    return [...reportEntries, ...logEntries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [selectedProject, selectedProjectLogs, selectedProjectReports]);

  return (
    <div className="stack-page">
      <section className="panel project-home-panel">
        <div className="project-home-head">
          <div>
            <p className="eyebrow">Project Home</p>
            <h2>프로젝트 홈</h2>
          </div>
          <div className="studio-tab-list compact-tabs" role="tablist" aria-label="프로젝트 탭">
            <button className={activeTab === "active" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("active")}>
              진행 중
            </button>
            <button className={activeTab === "all" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("all")}>
              전체
            </button>
            <button className={activeTab === "desk" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("desk")}>
              추가 / 수정
            </button>
          </div>
        </div>

        {activeTab === "desk" ? (
          <div className="compact-project-desk">
            <div className="project-desk-layout">
              <div className="project-desk-editor">
                <section className="project-desk-section">
                  <div className="project-desk-section-head">
                    <h3>{form.id ? "프로젝트 수정" : "기본 정보"}</h3>
                    <span>먼저 이름, 카테고리, 지금 당장 할 일만 적어도 충분해요.</span>
                  </div>
                  <div className="form-grid compact-form-grid">
                    <label>
                      <span>프로젝트명</span>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 교사용 투두앱" />
                    </label>
                    <label>
                      <span>카테고리</span>
                      <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="예: 교사용 웹" />
                    </label>
                    <label className="full-width">
                      <span>다음 업무</span>
                      <input value={form.nextTask} onChange={(e) => setForm({ ...form, nextTask: e.target.value })} placeholder="예: 질문 기능 테스트" />
                    </label>
                  </div>
                </section>

                <button
                  type="button"
                  className="ghost-button detail-toggle"
                  onClick={() => setShowDetails((current) => !current)}
                >
                  {showDetails ? "자세한 정보 접기" : "자세한 정보 펼치기"}
                </button>

                {showDetails && (
                  <>
                    <section className="project-desk-section">
                      <div className="project-desk-section-head">
                        <h3>진행 상태</h3>
                        <span>오늘 우선순위 추천에 활용되는 정보예요.</span>
                      </div>
                      <div className="form-grid compact-form-grid">
                        <label>
                          <span>상태</span>
                          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
                            <option>기획 중</option>
                            <option>디자인 중</option>
                            <option>개발 중</option>
                            <option>완료</option>
                            <option>보류</option>
                          </select>
                        </label>
                        <label>
                          <span>우선순위</span>
                          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as ProjectPriority })}>
                            <option>낮음</option>
                            <option>보통</option>
                            <option>높음</option>
                            <option>긴급</option>
                          </select>
                        </label>
                        <label>
                          <span>진행률</span>
                          <input type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} placeholder="진행률" />
                        </label>
                        <label>
                          <span>마감일</span>
                          <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                        </label>
                        <label>
                          <span>최근 작업일</span>
                          <input type="date" value={form.lastWorkedAt} onChange={(e) => setForm({ ...form, lastWorkedAt: e.target.value })} />
                        </label>
                      </div>
                    </section>

                    <section className="project-desk-section">
                      <div className="project-desk-section-head">
                        <h3>추가 메모</h3>
                        <span>설명이나 지연 이유처럼 나중에 봐도 되는 정보는 여기에 남겨요.</span>
                      </div>
                      <div className="form-grid compact-form-grid">
                        <label className="full-width">
                          <span>설명</span>
                          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="누구를 위한 어떤 프로젝트인지 적어주세요." />
                        </label>
                        <label className="full-width">
                          <span>지연 사유</span>
                          <textarea value={form.delayReason ?? ""} onChange={(e) => setForm({ ...form, delayReason: e.target.value })} placeholder="없으면 비워두세요." />
                        </label>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
            <div className="project-desk-actions">
              <button className="ghost-button" onClick={resetProjectForm}>
                새 프로젝트로 시작
              </button>
              <button className="primary-button" onClick={saveProject}>
                {form.id ? "프로젝트 저장" : "프로젝트 등록"}
              </button>
            </div>
          </div>
        ) : (
          <div className="project-home-summary">
            <span>진행 중 {projects.filter((project) => project.status !== "완료" && project.status !== "보류").length}</span>
            <span>완료 {projects.filter((project) => project.status === "완료").length}</span>
            <span>보류 {projects.filter((project) => project.status === "보류").length}</span>
          </div>
        )}
      </section>
      {activeTab !== "desk" && (
        <>
          {visibleProjects.length > 0 ? (
            <section className="project-grid compact-project-grid">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onEdit={openEditDesk}
                  onSelect={setSelectedProjectId}
                  selected={selectedProject?.id === project.id}
                  recentLog={logs.find((log) => log.message.includes(project.name))}
                />
              ))}
            </section>
          ) : (
            <section className="panel empty-flow-panel">
              <div className="project-desk-section-head">
                <h3>아직 프로젝트가 없어요</h3>
                <span>추가 / 수정 탭에서 첫 프로젝트를 만들면 세나가 바로 흐름을 이어서 정리해드려요.</span>
              </div>
            </section>
          )}

          {selectedProject && (
            <section className="panel project-context-panel">
              <div className="project-home-head project-context-head">
                <div>
                  <p className="eyebrow">Project Context</p>
                  <h2>{selectedProject.name} 맥락 보드</h2>
                </div>
                <span className="soft-badge">누적 저장됨</span>
              </div>

              <div className="project-context-grid">
                <article className="project-context-summary">
                  <div className="project-context-block">
                    <span className="project-context-label">지금 이어갈 핵심</span>
                    <strong>{selectedProject.nextTask || "다음 업무를 정리해보세요."}</strong>
                  </div>
                  <div className="project-context-mini-grid">
                    <article>
                      <span>최근 작업일</span>
                      <strong>{selectedProject.lastWorkedAt}</strong>
                    </article>
                    <article>
                      <span>진행률</span>
                      <strong>{selectedProject.progress}%</strong>
                    </article>
                    <article>
                      <span>최근 팀 회의</span>
                      <strong>{selectedProjectReports.length}건</strong>
                    </article>
                  </div>
                  <div className="project-context-block">
                    <span className="project-context-label">세나 요약</span>
                    <p>
                      {selectedProjectReports[0]?.task.summary ??
                        `${selectedProject.name} 프로젝트는 ${selectedProject.nextTask || "다음 업무"} 기준으로 이어가면 좋아요.`}
                    </p>
                  </div>
                </article>

                <article className="project-context-timeline">
                  <div className="project-desk-section-head">
                    <h3>누적된 대화와 진행</h3>
                    <span>지시, 회의, 저장된 결정이 시간순으로 이어집니다.</span>
                  </div>
                  <div className="project-context-list">
                    {projectTimeline.map((entry) => (
                      <article key={entry.id} className="project-context-entry">
                        <span className="project-context-entry-label">{entry.label}</span>
                        <strong>{entry.title}</strong>
                        <p>{entry.detail}</p>
                      </article>
                    ))}
                    {projectTimeline.length === 0 && (
                      <p className="empty-state">아직 이 프로젝트에 연결된 지시나 기록이 없어요.</p>
                    )}
                  </div>
                </article>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
