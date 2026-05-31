import { useState } from "react";
import { departments } from "../data/defaultEmployees";
import DepartmentDoors from "../components/DepartmentDoors";
import DepartmentOffice from "../components/DepartmentOffice";
import MeetingRoomPanel from "../components/MeetingRoomPanel";
import RightPanel from "../components/RightPanel";
import TaskCommandBox from "../components/TaskCommandBox";
import type { ActivityLog, DepartmentId, Employee, InboxCategory, InboxItem, Project, TaskReport } from "../types";

interface TodayOfficePageProps {
  employees: Employee[];
  projects: Project[];
  logs: ActivityLog[];
  reports: TaskReport[];
  inbox: InboxItem[];
  selectedDepartment: DepartmentId;
  setSelectedDepartment: (department: DepartmentId) => void;
  onReportCreated: (report: TaskReport) => void;
  onAdoptPlan: (payload: {
    reportId: string;
    departmentId: DepartmentId;
    selectedTitle: string;
    nextRequest: string;
  }) => void;
  onSaveInboxItem: (payload: {
    title: string;
    category: InboxCategory;
    projectId?: string;
    projectName?: string;
  }) => InboxItem;
  onUpdateInboxItem: (id: string, changes: Partial<InboxItem>) => void;
  onCreateProjectFromInbox: (itemId: string) => Project | undefined;
}

export default function TodayOfficePage({
  employees,
  projects,
  logs,
  reports,
  inbox,
  selectedDepartment,
  setSelectedDepartment,
  onReportCreated,
  onAdoptPlan,
  onSaveInboxItem,
  onUpdateInboxItem,
  onCreateProjectFromInbox,
}: TodayOfficePageProps) {
  const [activeStudioTab, setActiveStudioTab] = useState<"briefing" | "team" | "meeting" | "command">("briefing");
  const [prefillCommand, setPrefillCommand] = useState("");
  const [prefillVersion, setPrefillVersion] = useState(0);
  const latestReport = reports[0];

  const handleAdoptPlan = (payload: {
    reportId: string;
    departmentId: DepartmentId;
    selectedTitle: string;
    nextRequest: string;
  }) => {
    onAdoptPlan(payload);
    setPrefillCommand(payload.nextRequest);
    setPrefillVersion((current) => current + 1);
    setActiveStudioTab("command");
  };

  return (
    <div className="today-layout">
      <div className="today-main">
        <section className="panel studio-tabs-panel">
          <div className="studio-tab-list" role="tablist" aria-label="오피스 스튜디오 탭">
            <button
              className={activeStudioTab === "briefing" ? "studio-tab active" : "studio-tab"}
              onClick={() => setActiveStudioTab("briefing")}
            >
              오늘 브리핑
            </button>
            <button
              className={activeStudioTab === "team" ? "studio-tab active" : "studio-tab"}
              onClick={() => setActiveStudioTab("team")}
            >
              팀 스튜디오
            </button>
            <button
              className={activeStudioTab === "meeting" ? "studio-tab active" : "studio-tab"}
              onClick={() => setActiveStudioTab("meeting")}
            >
              회의실
            </button>
            <button
              className={activeStudioTab === "command" ? "studio-tab active" : "studio-tab"}
              onClick={() => setActiveStudioTab("command")}
            >
              안건 전달
            </button>
          </div>

          <div className="studio-tab-body">
            {activeStudioTab === "briefing" && (
              <RightPanel
                projects={projects}
                logs={logs}
                reports={reports}
                selectedDepartment={selectedDepartment}
              />
            )}

            {activeStudioTab === "team" && (
              <div className="studio-team-view">
                <DepartmentDoors
                  selectedDepartment={selectedDepartment}
                  setSelectedDepartment={setSelectedDepartment}
                  employees={employees}
                  projects={projects}
                />
                <DepartmentOffice
                  departmentId={selectedDepartment}
                  employees={employees}
                  activeReport={latestReport}
                />
              </div>
            )}

            {activeStudioTab === "meeting" && (
              <MeetingRoomPanel report={latestReport} departmentId={selectedDepartment} onAdoptPlan={handleAdoptPlan} />
            )}

            {activeStudioTab === "command" && (
              <TaskCommandBox
                projects={projects}
                inboxItems={inbox}
                onReportCreated={onReportCreated}
                onSaveInboxItem={onSaveInboxItem}
                onUpdateInboxItem={onUpdateInboxItem}
                onCreateProjectFromInbox={onCreateProjectFromInbox}
                onMeetingStarted={() => setActiveStudioTab("meeting")}
                prefillCommand={prefillCommand}
                prefillVersion={prefillVersion}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
