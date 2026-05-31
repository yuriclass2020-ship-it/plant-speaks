import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MessagesSquare, Sparkles } from "lucide-react";
import { buildExecutionPlan, buildMeetingMessages } from "../services/mockAiWorkers";
import { getAvatarClass } from "./EmployeeCard";
import type { DepartmentId, TaskReport } from "../types";

interface MeetingRoomPanelProps {
  report?: TaskReport;
  departmentId: DepartmentId;
  onAdoptPlan?: (payload: {
    reportId: string;
    departmentId: DepartmentId;
    selectedTitle: string;
    nextRequest: string;
  }) => void;
}

export default function MeetingRoomPanel({ report, departmentId, onAdoptPlan }: MeetingRoomPanelProps) {
  const messages = report ? buildMeetingMessages(report, departmentId) : [];
  const optionTitles = useMemo(() => {
    if (!report) return [];
    const taskOptions = report.task.todayTasks.slice(0, 2).map((task) => task.title);
    return taskOptions.length > 0 ? taskOptions : ["대표님이 우선안을 확정해 주세요."];
  }, [report]);
  const [selectedOption, setSelectedOption] = useState<string>("");

  useEffect(() => {
    setSelectedOption(optionTitles[0] ?? "");
  }, [optionTitles]);
  const [adoptedTitle, setAdoptedTitle] = useState<string>("");

  if (!report || messages.length === 0) {
    return (
      <section className="panel meeting-panel empty-report">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Meeting Room</p>
            <h2>AI 직원 회의실</h2>
          </div>
        </div>
        <p className="recent-copy">안건을 전달하면 세나가 회의를 열고, 팀별 의견을 실제 대화처럼 정리해드려요.</p>
      </section>
    );
  }

  const plan = selectedOption ? buildExecutionPlan(report, departmentId, selectedOption) : undefined;

  const adoptPlan = () => {
    if (!report || !plan || !selectedOption) return;
    onAdoptPlan?.({
      reportId: report.id,
      departmentId,
      selectedTitle: selectedOption,
      nextRequest: plan.nextRequest,
    });
    setAdoptedTitle(selectedOption);
  };

  return (
    <section className="panel meeting-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Meeting Room</p>
          <h2>{report.task.projectName} 팀 회의</h2>
        </div>
        <span className="soft-badge">핵심 {Math.min(messages.length, 3)}개</span>
      </div>
      <div className="meeting-thread">
        {messages.slice(0, 3).map((message) => (
          <article key={message.id} className={`meeting-bubble tone-${message.tone}`}>
            <div className={`meeting-avatar ${getAvatarClass(message.speakerId)}`} />
            <div className="meeting-copy">
              <div className="meeting-meta">
                <strong>{message.speakerName}</strong>
                <span>{message.speakerTitle}</span>
              </div>
              <p>{message.text}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="meeting-decision-block">
        <div className="meeting-decision-head">
          <strong>대표님 선택</strong>
          <span>하나만 먼저 고르면 실행안이 바로 정리돼요.</span>
        </div>
        <div className="meeting-actions">
          {optionTitles.map((title) => (
            <button
              key={title}
              className={selectedOption === title ? "meeting-action-chip emphasis" : "meeting-action-chip"}
              onClick={() => setSelectedOption(title)}
            >
              <CheckCircle2 size={15} />
              {title}
            </button>
          ))}
        </div>
      </div>
      {plan && (
        <div className="meeting-plan-card">
          <div className="meeting-plan-head">
            <div>
              <p className="eyebrow">Next Move</p>
              <h3>{plan.title}</h3>
            </div>
            <span className="soft-badge">실행안 준비됨</span>
          </div>
          <p className="meeting-plan-summary">{plan.summary}</p>
          <ul className="meeting-plan-list">
            {plan.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <div className="meeting-next-request">
            <div className="meeting-next-request-head">
              <Sparkles size={15} />
              <strong>세나가 이어서 보낼 요청문</strong>
            </div>
            <p>{plan.nextRequest}</p>
          </div>
          <button className="meeting-action-chip emphasis meeting-send-chip" onClick={adoptPlan}>
            <MessagesSquare size={15} />
            {adoptedTitle === selectedOption ? "오늘 업무에 반영됨" : "이 방향을 오늘 업무로 반영"}
          </button>
        </div>
      )}
    </section>
  );
}
