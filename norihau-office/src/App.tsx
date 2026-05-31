import { useEffect, useMemo, useState } from "react";
import Layout from "./components/Layout";
import TodayOfficePage from "./pages/TodayOfficePage";
import ProjectsPage from "./pages/ProjectsPage";
import EmployeesPage from "./pages/EmployeesPage";
import FinancePage from "./pages/FinancePage";
import RecordsPage from "./pages/RecordsPage";
import { departments } from "./data/defaultEmployees";
import { getDday, getTopPriorityProject } from "./services/priorityEngine";
import { storage } from "./services/storage";
import type { ActivityLog, DepartmentId, Employee, InboxCategory, InboxItem, MenuKey, Project, Subscription, TaskReport } from "./types";

function App() {
  const [activeMenu, setActiveMenu] = useState<MenuKey>("today");
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentId>("secretary");
  const [employees, setEmployees] = useState<Employee[]>(() => storage.getEmployees());
  const [projects, setProjects] = useState<Project[]>(() => storage.getProjects());
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => storage.getSubscriptions());
  const [logs, setLogs] = useState<ActivityLog[]>(() => storage.getLogs());
  const [reports, setReports] = useState<TaskReport[]>(() => storage.getReports());
  const [inbox, setInbox] = useState<InboxItem[]>(() => storage.getInbox());

  useEffect(() => storage.saveEmployees(employees), [employees]);
  useEffect(() => storage.saveProjects(projects), [projects]);
  useEffect(() => storage.saveSubscriptions(subscriptions), [subscriptions]);
  useEffect(() => storage.saveLogs(logs), [logs]);
  useEffect(() => storage.saveReports(reports), [reports]);
  useEffect(() => storage.saveInbox(inbox), [inbox]);

  const addLog = (message: string, type: ActivityLog["type"]) => {
    setLogs((current) => [
      { id: crypto.randomUUID(), message, type, createdAt: new Date().toISOString() },
      ...current,
    ].slice(0, 60));
  };

  const resetWorkspace = () => {
    setProjects([]);
    setSubscriptions([]);
    setLogs([]);
    setReports([]);
    storage.resetWorkspace();
    setActiveMenu("today");
  };

  const handleReportCreated = (report: TaskReport) => {
    setReports((current) => [report, ...current]);
    if (report.task.sourceInboxId) {
      setInbox((current) =>
        current.map((item) =>
          item.id === report.task.sourceInboxId
            ? { ...item, status: "회의 준비", lastUpdatedAt: new Date().toISOString() }
            : item,
        ),
      );
    }
    addLog(`${report.task.projectName} 업무 지시가 ${report.results.length}개 부서에 배정되었습니다.`, "report");
    if (report.task.assignedDepartments.length > 1) {
      setSelectedDepartment(report.task.assignedDepartments[1]);
    }
  };

  const handleAdoptPlan = ({
    reportId,
    departmentId,
    selectedTitle,
    nextRequest,
  }: {
    reportId: string;
    departmentId: DepartmentId;
    selectedTitle: string;
    nextRequest: string;
  }) => {
    const targetReport = reports.find((report) => report.id === reportId);
    if (!targetReport) return;

    setReports((current) =>
      current.map((report) =>
        report.id === reportId
          ? {
              ...report,
              task: {
                ...report.task,
                todayTasks: report.task.todayTasks.map((task) =>
                  task.title === selectedTitle ? { ...task, done: true } : task,
                ),
              },
            }
          : report,
      ),
    );

    if (targetReport.task.projectId) {
      setProjects((current) =>
        current.map((project) =>
          project.id === targetReport.task.projectId
            ? {
                ...project,
                nextTask: selectedTitle,
                lastWorkedAt: new Date().toISOString().slice(0, 10),
                priority: targetReport.task.urgency,
              }
            : project,
        ),
      );
    }

    if (targetReport.task.sourceInboxId) {
      setInbox((current) =>
        current.map((item) =>
          item.id === targetReport.task.sourceInboxId
            ? {
                ...item,
                status: "결정 완료",
                projectId: targetReport.task.projectId,
                projectName: targetReport.task.projectName,
                lastUpdatedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
    }

    addLog(`${targetReport.task.projectName}에서 '${selectedTitle}' 안건이 확정되었습니다.`, "task");
    addLog(`세나 실행안 저장: ${nextRequest}`, "report");
    setSelectedDepartment(departmentId);
  };

  const saveInboxItem = ({
    title,
    category,
    projectId,
    projectName,
  }: {
    title: string;
    category: InboxCategory;
    projectId?: string;
    projectName?: string;
  }) => {
    const item: InboxItem = {
      id: crypto.randomUUID(),
      title,
      category,
      status: "보관 중",
      projectId,
      projectName,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
    setInbox((current) => [item, ...current]);
    addLog(`안건 인박스에 '${title}'가 저장되었습니다.`, "task");
    return item;
  };

  const updateInboxItem = (id: string, changes: Partial<InboxItem>) => {
    setInbox((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...changes, lastUpdatedAt: new Date().toISOString() } : item,
      ),
    );
  };

  const createProjectFromInbox = (itemId: string) => {
    const item = inbox.find((entry) => entry.id === itemId);
    if (!item) return;

    const projectName = item.title.replace(/\s+/g, " ").trim().slice(0, 24) || "새 프로젝트";
    const categoryByInbox: Record<InboxCategory, string> = {
      아이디어: "신규 아이디어",
      콘텐츠: "교육콘텐츠",
      기능: "프로덕트 기능",
      홍보: "브랜드 콘텐츠",
      운영: "운영 업무",
    };

    const project: Project = {
      id: crypto.randomUUID(),
      name: projectName,
      description: item.title,
      category: categoryByInbox[item.category],
      status: "기획 중",
      progress: 0,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10),
      priority: "보통",
      nextTask: item.title,
      lastWorkedAt: new Date().toISOString().slice(0, 10),
    };

    setProjects((current) => [project, ...current]);
    setInbox((current) =>
      current.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              projectId: project.id,
              projectName: project.name,
              lastUpdatedAt: new Date().toISOString(),
            }
          : entry,
      ),
    );
    addLog(`안건 '${item.title}'에서 ${project.name} 프로젝트가 생성되었습니다.`, "project");
    return project;
  };

  const page = useMemo(() => {
    if (activeMenu === "projects") {
      return <ProjectsPage projects={projects} setProjects={setProjects} addLog={addLog} logs={logs} reports={reports} />;
    }
    if (activeMenu === "employees") {
      return <EmployeesPage employees={employees} setEmployees={setEmployees} addLog={addLog} />;
    }
    if (activeMenu === "finance") {
      return (
        <FinancePage subscriptions={subscriptions} setSubscriptions={setSubscriptions} addLog={addLog} />
      );
    }
    if (activeMenu === "records") {
      return <RecordsPage logs={logs} reports={reports} projects={projects} />;
    }
    if (activeMenu === "settings") {
      return (
        <section className="panel settings-panel">
          <p className="eyebrow">Settings</p>
          <h2>설정</h2>
          <p>현재 MVP는 서버 없이 localStorage에 저장됩니다. 나중에 OpenAI API를 연결할 때는 services 폴더의 라우터와 mock 워커를 교체하면 됩니다.</p>
          <div className="settings-actions">
            <button className="ghost-button" onClick={resetWorkspace}>
              오피스 내용 비우고 처음부터 시작하기
            </button>
          </div>
        </section>
      );
    }

    return (
      <TodayOfficePage
        employees={employees}
        projects={projects}
        logs={logs}
        reports={reports}
        inbox={inbox}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
        onReportCreated={handleReportCreated}
        onAdoptPlan={handleAdoptPlan}
        onSaveInboxItem={saveInboxItem}
        onUpdateInboxItem={updateInboxItem}
        onCreateProjectFromInbox={createProjectFromInbox}
      />
    );
  }, [activeMenu, employees, projects, subscriptions, logs, reports, inbox, selectedDepartment]);

  const topProject = getTopPriorityProject(projects);
  const latestReport = reports[0];
  const summaryTeam = departments.find((item) => item.id === selectedDepartment);
  const officeSummary = {
    title: latestReport?.task.projectName ?? topProject?.name ?? "첫 안건을 시작해보세요",
    detail: latestReport?.task.summary
      ?? (topProject
        ? `${topProject.nextTask}부터 차분히 정리해보면 좋아요.`
        : "프로젝트 홈에서 첫 프로젝트를 만들거나, 안건 전달 탭에서 세나에게 첫 안건을 보내면 바로 시작할 수 있어요."),
    meta: [
      topProject ? `D-${Math.max(getDday(topProject.deadline), 0)}` : "첫 시작",
      summaryTeam?.name ?? "팀 선택",
      latestReport ? `${latestReport.results.length}개 팀 참여` : "세나 준비 완료",
    ],
  };

  return (
    <Layout activeMenu={activeMenu} setActiveMenu={setActiveMenu} officeSummary={officeSummary}>
      {page}
    </Layout>
  );
}

export default App;
