import { defaultEmployees, departments } from "../data/defaultEmployees";
import type { DepartmentId, MeetingMessage, RoutedTask, TaskReport, TeamResult } from "../types";

export interface ExecutionPlan {
  title: string;
  summary: string;
  steps: string[];
  nextRequest: string;
}

const resultFactories: Record<DepartmentId, (task: RoutedTask) => TeamResult["sections"]> = {
  secretary: (task) => [
    {
      title: "비서실 분석",
      items: [
        `${task.projectName} 업무는 ${task.taskType} 중심으로 처리하면 좋습니다.`,
        `긴급도는 ${task.urgency}이며 오늘 실행 단위를 작게 나눴습니다.`,
        "팀별 산출물을 모아 최종 보고서 형태로 정리합니다.",
      ],
    },
  ],
  content: (task) => [
    { title: "교육적 목적", items: ["유아가 질문하고 탐색하는 경험을 확장합니다.", "교사의 개입은 짧고 관찰 중심으로 설계합니다."] },
    { title: "놀이 흐름", items: [`${task.projectName} 도입 질문 만들기`, "탐색, 표현, 공유 단계로 활동을 나눕니다."] },
    { title: "유아 경험 확장", items: ["아이의 언어를 기록으로 연결합니다.", "가정 연계 질문 카드로 확장할 수 있습니다."] },
  ],
  design: () => [
    { title: "화면 구성", items: ["상단에 현재 업무 맥락을 보여줍니다.", "질문 입력, 추천 질문, 결과 영역을 분리합니다."] },
    { title: "필요한 아이콘", items: ["질문", "확인", "다시 생성", "저장", "교사 메모"] },
    { title: "UI 방향", items: ["크림 배경에 딥그린 버튼을 사용합니다.", "카드는 넓은 여백과 부드러운 그림자로 정리합니다."] },
  ],
  development: (task) => [
    { title: "기능 목록", items: ["질문 입력", "질문 검증", "응답 표시", "기록 저장", "테스트 체크리스트"] },
    { title: "구현 단계", items: ["상태 모델 정의", "입력 컴포넌트 작성", "mock 응답 연결", "localStorage 저장", "예외 상태 처리"] },
    { title: "개발 요청문", items: [`${task.projectName}에 ${task.command} 요구를 반영하는 React 기능을 만들어줘. 입력, 결과, 저장 상태를 분리하고 테스트 가능한 구조로 작성해줘.`] },
  ],
  marketing: (task) => [
    { title: "인스타 캡션", items: [`${task.projectName}로 아이의 질문이 놀이가 되는 순간을 기록해보세요.`] },
    { title: "릴스 제목", items: ["아이 질문 하나로 시작되는 프로젝트 수업", "교사의 기록이 쉬워지는 AI 놀이 도구"] },
    { title: "소개 문구", items: ["유아의 호기심을 교사의 기록과 연결하는 따뜻한 교육콘텐츠입니다."] },
  ],
  finance: () => [
    { title: "예상 작업 시간", items: ["기획 2시간", "디자인 2시간", "개발 5시간", "검토 1시간"] },
    { title: "예상 제작 비용", items: ["시간당 30,000원 기준 약 300,000원"] },
    { title: "운영비 영향", items: ["추가 API 연동 전까지 월 고정비 증가는 없습니다."] },
  ],
};

export function generateTaskReport(task: RoutedTask): TaskReport {
  const results = task.assignedDepartments.map((departmentId) => {
    const department = departments.find((item) => item.id === departmentId);
    return {
      departmentId,
      departmentName: department?.name ?? departmentId,
      sections: resultFactories[departmentId](task),
    };
  });

  return {
    id: crypto.randomUUID(),
    task,
    results,
    createdAt: new Date().toISOString(),
  };
}

export function buildMeetingMessages(report: TaskReport, departmentId: DepartmentId): MeetingMessage[] {
  const teamResult = report.results.find((result) => result.departmentId === departmentId);
  const departmentMembers = defaultEmployees.filter((employee) => employee.departmentId === departmentId);
  const lead = departmentMembers[0];
  const support = departmentMembers[1] ?? lead;
  const secretary = defaultEmployees.find((employee) => employee.departmentId === "secretary");

  if (!teamResult || !lead || !support || !secretary) {
    return [];
  }

  const firstSection = teamResult.sections[0];
  const secondSection = teamResult.sections[1] ?? firstSection;
  const finalTask = report.task.todayTasks[0]?.title ?? "대표님이 우선안을 확정해 주세요.";

  return [
    {
      id: `${report.id}-host`,
      speakerId: secretary.id,
      speakerName: secretary.name,
      speakerTitle: secretary.title,
      departmentId: "secretary",
      tone: "host",
      text: `${report.task.projectName} 안건을 ${teamResult.departmentName}과 함께 검토 중이에요. 지금부터 핵심 의견만 짧게 공유드릴게요.`,
    },
    {
      id: `${report.id}-lead`,
      speakerId: lead.id,
      speakerName: lead.name,
      speakerTitle: lead.title,
      departmentId,
      tone: "team",
      text: `${firstSection.title} 기준으로 보면, ${firstSection.items[0]}`,
    },
    {
      id: `${report.id}-support`,
      speakerId: support.id,
      speakerName: support.name,
      speakerTitle: support.title,
      departmentId,
      tone: "team",
      text: `${secondSection.title} 쪽에서는 ${secondSection.items[0]}`,
    },
    {
      id: `${report.id}-decision`,
      speakerId: secretary.id,
      speakerName: secretary.name,
      speakerTitle: secretary.title,
      departmentId: "secretary",
      tone: "decision",
      text: `대표님 결정 포인트는 '${finalTask}'입니다. 이 방향을 확정하면 다음 요청까지 바로 이어드릴게요.`,
    },
  ];
}

export function buildExecutionPlan(report: TaskReport, departmentId: DepartmentId, selectedTitle: string): ExecutionPlan {
  const teamResult = report.results.find((result) => result.departmentId === departmentId);
  const firstSection = teamResult?.sections[0];
  const secondSection = teamResult?.sections[1] ?? firstSection;
  const leadPoint = firstSection?.items[0] ?? "핵심 방향을 짧게 정리합니다.";
  const supportPoint = secondSection?.items[0] ?? "바로 실행할 한 단계를 잡습니다.";

  return {
    title: selectedTitle,
    summary: `${teamResult?.departmentName ?? "팀"} 기준으로 '${selectedTitle}'를 먼저 확정하고 바로 다음 요청으로 넘길 수 있어요.`,
    steps: [
      `세나가 '${selectedTitle}'를 오늘 최우선 안건으로 고정합니다.`,
      `${teamResult?.departmentName ?? "해당 팀"} 의견에서 '${leadPoint}'를 실행 기준으로 삼습니다.`,
      `${supportPoint}를 기준으로 대표님 확인용 초안을 먼저 만듭니다.`,
    ],
    nextRequest: `${report.task.projectName} 안건에서 '${selectedTitle}'를 우선으로 진행할게. ${teamResult?.departmentName ?? "해당 팀"} 기준 핵심 방향은 '${leadPoint}'야. 이 기준으로 바로 실행 초안 만들어줘.`,
  };
}
