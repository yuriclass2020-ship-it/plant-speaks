export type MenuKey = "today" | "projects" | "employees" | "finance" | "records" | "settings";

export type DepartmentId =
  | "secretary"
  | "content"
  | "design"
  | "development"
  | "marketing"
  | "finance";

export type EmployeeStatus = "작업 가능" | "작업 중" | "검토 필요" | "회의 중" | "대기 중";

export type ProjectStatus = "기획 중" | "디자인 중" | "개발 중" | "완료" | "보류";

export type ProjectPriority = "낮음" | "보통" | "높음" | "긴급";
export type InboxCategory = "아이디어" | "콘텐츠" | "기능" | "홍보" | "운영";
export type InboxStatus = "보관 중" | "회의 준비" | "결정 완료";

export type HealthStatus = "안정적" | "지연 위험" | "과부하 위험";

export interface Department {
  id: DepartmentId;
  name: string;
  description: string;
  color: string;
}

export interface Employee {
  id: string;
  name: string;
  departmentId: DepartmentId;
  title: string;
  role: string;
  specialties: string[];
  tone: string;
  outputs: string[];
  status: EmployeeStatus;
  currentTask: string;
  progress: number;
  avatar: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ProjectStatus;
  progress: number;
  deadline: string;
  priority: ProjectPriority;
  nextTask: string;
  lastWorkedAt: string;
  delayReason?: string;
}

export interface InboxItem {
  id: string;
  title: string;
  category: InboxCategory;
  status: InboxStatus;
  projectId?: string;
  projectName?: string;
  createdAt: string;
  lastUpdatedAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  done: boolean;
}

export interface RoutedTask {
  id: string;
  command: string;
  sourceInboxId?: string;
  projectId?: string;
  projectName: string;
  taskType: string;
  assignedDepartments: DepartmentId[];
  todayTasks: TaskItem[];
  urgency: ProjectPriority;
  createdAt: string;
  summary: string;
}

export interface TeamResult {
  departmentId: DepartmentId;
  departmentName: string;
  sections: {
    title: string;
    items: string[];
  }[];
}

export interface TaskReport {
  id: string;
  task: RoutedTask;
  results: TeamResult[];
  createdAt: string;
}

export interface MeetingMessage {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerTitle: string;
  departmentId: DepartmentId;
  tone: "host" | "team" | "decision";
  text: string;
}

export interface Subscription {
  id: string;
  toolName: string;
  monthlyCost: number;
  purpose: string;
}

export interface ProductionEstimate {
  projectName: string;
  planningHours: number;
  designHours: number;
  developmentHours: number;
  marketingHours: number;
  hourlyRate: number;
}

export interface ActivityLog {
  id: string;
  message: string;
  type: "task" | "project" | "employee" | "finance" | "report";
  createdAt: string;
}
