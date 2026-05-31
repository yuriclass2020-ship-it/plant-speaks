import type { Employee } from "../types";

export const avatarPositionByEmployeeId: Record<string, { x: number; y: number }> = {
  "emp-sena": { x: 0, y: 0 },
  "emp-nori": { x: 1, y: 0 },
  "emp-dada": { x: 2, y: 0 },
  "emp-mimi": { x: 0, y: 1 },
  "emp-cody": { x: 1, y: 1 },
  "emp-junior": { x: 2, y: 1 },
  "emp-error": { x: 0, y: 2 },
  "emp-popo": { x: 1, y: 2 },
  "emp-momo": { x: 2, y: 2 },
};

export const avatarOptions = [
  { id: "emp-sena", label: "세나 타입" },
  { id: "emp-nori", label: "노리 타입" },
  { id: "emp-dada", label: "다다 타입" },
  { id: "emp-mimi", label: "미미 타입" },
  { id: "emp-cody", label: "코디 타입" },
  { id: "emp-junior", label: "신입개발봇 타입" },
  { id: "emp-error", label: "오류분석봇 타입" },
  { id: "emp-popo", label: "포포 타입" },
  { id: "emp-momo", label: "모모 타입" },
] as const;

export const newHireAvatarOptions = [
  { id: "hire-mint-bob", name: "하니", label: "민트 단발" },
  { id: "hire-center-part", name: "리오", label: "센터 가르마" },
  { id: "hire-high-pony", name: "소미", label: "하이 포니테일" },
  { id: "hire-curly-boy", name: "태오", label: "컬리 숏헤어" },
  { id: "hire-robot-tablet", name: "루프", label: "크림 로봇" },
  { id: "hire-coral-curl", name: "유나", label: "코랄 컬" },
] as const;

const newHireAvatarPositionById: Record<string, { x: number; y: number }> = {
  "hire-mint-bob": { x: 0, y: 0 },
  "hire-center-part": { x: 1, y: 0 },
  "hire-high-pony": { x: 2, y: 0 },
  "hire-curly-boy": { x: 0, y: 1 },
  "hire-robot-tablet": { x: 1, y: 1 },
  "hire-coral-curl": { x: 2, y: 1 },
};

function resolveAvatarKey(employee: Employee) {
  if (employee.avatar && avatarPositionByEmployeeId[employee.avatar]) {
    return employee.avatar;
  }

  if (employee.avatar && newHireAvatarPositionById[employee.avatar]) {
    return employee.avatar;
  }

  if (avatarPositionByEmployeeId[employee.id]) {
    return employee.id;
  }

  return "emp-nori";
}

export function getAvatarClass(avatarKey: string) {
  if (newHireAvatarPositionById[avatarKey]) {
    const position = newHireAvatarPositionById[avatarKey];
    return `avatar-sheet-new avatar-new-x-${position.x} avatar-new-y-${position.y}`;
  }

  const position = avatarPositionByEmployeeId[avatarKey] ?? { x: 1, y: 2 };
  return `avatar-x-${position.x} avatar-y-${position.y}`;
}

export default function EmployeeCard({ employee }: { employee: Employee }) {
  return (
    <article className="employee-card">
      <div className={`employee-photo-avatar ${getAvatarClass(resolveAvatarKey(employee))}`} />
      <div className="employee-meta">
        <div className="employee-name">{employee.name}</div>
        <div className="employee-role">{employee.title}</div>
      </div>
      <div className="status-row">
        <span className={`status-pill status-${employee.status.replace(/\s/g, "-")}`}>{employee.status}</span>
        <span>{employee.progress}%</span>
      </div>
      <div className="progress-track">
        <div style={{ width: `${employee.progress}%` }} />
      </div>
    </article>
  );
}
