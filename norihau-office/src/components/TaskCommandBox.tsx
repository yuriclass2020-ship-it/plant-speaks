import { SendHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { generateTaskReport } from "../services/mockAiWorkers";
import { routeTask } from "../services/taskRouter";
import type { InboxCategory, InboxItem, Project, TaskReport } from "../types";

const inboxCategories: InboxCategory[] = ["아이디어", "콘텐츠", "기능", "홍보", "운영"];

interface TaskCommandBoxProps {
  projects: Project[];
  inboxItems: InboxItem[];
  onReportCreated: (report: TaskReport) => void;
  onSaveInboxItem: (payload: {
    title: string;
    category: InboxCategory;
    projectId?: string;
    projectName?: string;
  }) => InboxItem;
  onUpdateInboxItem: (id: string, changes: Partial<InboxItem>) => void;
  onCreateProjectFromInbox: (itemId: string) => Project | undefined;
  onMeetingStarted?: () => void;
  compact?: boolean;
  prefillCommand?: string;
  prefillVersion?: number;
}

export default function TaskCommandBox({
  projects,
  inboxItems,
  onReportCreated,
  onSaveInboxItem,
  onUpdateInboxItem,
  onCreateProjectFromInbox,
  onMeetingStarted,
  compact = false,
  prefillCommand,
  prefillVersion,
}: TaskCommandBoxProps) {
  const [command, setCommand] = useState("");
  const [category, setCategory] = useState<InboxCategory>("아이디어");
  const [projectId, setProjectId] = useState("");
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    if (prefillCommand) {
      setCommand(prefillCommand);
      setCategory("기능");
    }
  }, [prefillCommand, prefillVersion]);

  const filteredInboxItems = [...inboxItems]
    .filter((item) => (showUnlinkedOnly ? !item.projectId : true))
    .filter((item) => (hideCompleted ? item.status !== "결정 완료" : true))
    .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());

  const startMeeting = (item: InboxItem) => {
    const routedTask = routeTask(item.title, projects, {
      sourceInboxId: item.id,
      projectIdOverride: item.projectId,
    });
    onReportCreated(generateTaskReport(routedTask));
    onMeetingStarted?.();
  };

  const resetDraft = () => {
    setCommand("");
    setCategory("아이디어");
    setProjectId("");
  };

  const saveToInbox = () => {
    if (!command.trim()) return;
    const linkedProject = projects.find((project) => project.id === projectId);
    onSaveInboxItem({
      title: command.trim(),
      category,
      projectId: linkedProject?.id,
      projectName: linkedProject?.name,
    });
    resetDraft();
  };

  const submitNow = () => {
    if (!command.trim()) return;
    const linkedProject = projects.find((project) => project.id === projectId);
    const item = onSaveInboxItem({
      title: command.trim(),
      category,
      projectId: linkedProject?.id,
      projectName: linkedProject?.name,
    });
    startMeeting(item);
    resetDraft();
  };

  return (
    <section className={compact ? "panel command-panel compact-command" : "panel command-panel"}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inbox Desk</p>
          <h2>{compact ? "안건 인박스" : "세나 안건 인박스"}</h2>
        </div>
      </div>

      <div className="inbox-composer">
        <div className="inbox-composer-main">
          <div className="inbox-categories">
            {inboxCategories.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? "filter-chip active" : "filter-chip"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <textarea
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="대표님, 떠오른 안건을 한 줄로 적어주세요. 세나가 회의로 이어드릴게요."
          />
        </div>

        <div className="inbox-action-rail">
          <label className="inbox-project-link">
            <span>연결 프로젝트</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">아직 정해지지 않음</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <div className="inbox-button-stack">
            <button className="ghost-button" onClick={saveToInbox}>
              인박스 저장
            </button>
            <button className="primary-button" onClick={submitNow}>
              <SendHorizontal size={17} />
              바로 회의 시작
            </button>
          </div>
        </div>
      </div>

      <div className="inbox-list">
        <div className="inbox-list-head">
          <div className="project-desk-section-head">
            <h3>저장된 안건</h3>
            <span>쌓아둔 안건은 프로젝트에 연결하고, 필요할 때 회의로 바로 이어갈 수 있어요.</span>
          </div>
          <div className="inbox-filters">
            <span className="soft-badge">최신순</span>
            <button
              type="button"
              className={showUnlinkedOnly ? "filter-chip active" : "filter-chip"}
              onClick={() => setShowUnlinkedOnly((current) => !current)}
            >
              시작 전 안건 보기
            </button>
            <button
              type="button"
              className={hideCompleted ? "filter-chip active" : "filter-chip"}
              onClick={() => setHideCompleted((current) => !current)}
            >
              완료된 안건 숨기기
            </button>
          </div>
        </div>

        {filteredInboxItems.length > 0 ? (
          <div className="inbox-card-list">
            {filteredInboxItems.map((item) => (
              <article key={item.id} className="inbox-card">
                <div className="inbox-card-main">
                  <strong>{item.title}</strong>
                  <div className="inbox-card-meta">
                    <span className="soft-badge">{item.category}</span>
                    <span className="soft-badge">{item.status}</span>
                    <small>{item.projectName ? `${item.projectName} 연결됨` : "미연결"}</small>
                  </div>
                </div>

                <div className="inbox-card-inline-controls">
                  <select
                    value={item.projectId ?? ""}
                    onChange={(event) => {
                      const linkedProject = projects.find((project) => project.id === event.target.value);
                      onUpdateInboxItem(item.id, {
                        projectId: linkedProject?.id,
                        projectName: linkedProject?.name,
                      });
                    }}
                  >
                    <option value="">프로젝트 연결</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>

                  {!item.projectId && (
                    <button className="ghost-button" onClick={() => onCreateProjectFromInbox(item.id)}>
                      프로젝트 생성
                    </button>
                  )}

                  <button className="ghost-button" onClick={() => startMeeting(item)}>
                    회의 시작
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">조건에 맞는 안건이 없어요. 필터를 풀거나 새 안건을 저장해보세요.</p>
        )}
      </div>
    </section>
  );
}
