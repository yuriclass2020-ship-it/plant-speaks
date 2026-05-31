import { BarChart3, Brush, Code2, Megaphone, Pencil, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { departments } from "../data/defaultEmployees";
import type { DepartmentId, Employee, Project } from "../types";

interface DepartmentDoorsProps {
  selectedDepartment: DepartmentId;
  setSelectedDepartment: (department: DepartmentId) => void;
  employees: Employee[];
  projects: Project[];
}

export default function DepartmentDoors({
  selectedDepartment,
  setSelectedDepartment,
  employees,
  projects,
}: DepartmentDoorsProps) {
  const icons: Record<DepartmentId, ReactNode> = {
    secretary: <UsersRound size={24} />,
    content: <Pencil size={24} />,
    design: <Brush size={24} />,
    development: <Code2 size={24} />,
    marketing: <Megaphone size={24} />,
    finance: <BarChart3 size={24} />,
  };

  const shortNames: Record<DepartmentId, string> = {
    secretary: "전략비서",
    content: "교육기획",
    design: "디자인",
    development: "제품개발",
    marketing: "브랜드",
    finance: "운영재무",
  };

  return (
    <section className="department-tabs-panel">
      <div className="department-tabs">
        {departments.map((department) => {
          const departmentEmployees = employees.filter((employee) => employee.departmentId === department.id);
          const delayed = projects.filter(
            (project) => project.status !== "완료" && project.delayReason,
          ).length;
          const delayCount = department.id === "secretary" ? Math.min(delayed, 3) : Math.min(delayed, 2);

          return (
            <button
              key={department.id}
              className={selectedDepartment === department.id ? "department-tab selected" : "department-tab"}
              onClick={() => setSelectedDepartment(department.id)}
            >
              <span className="department-tab-icon">{icons[department.id]}</span>
              <span className="department-tab-name">{shortNames[department.id]}</span>
              <span className={delayCount > 0 ? "department-tab-count delayed" : "department-tab-count"}>
                직원 {departmentEmployees.length}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
