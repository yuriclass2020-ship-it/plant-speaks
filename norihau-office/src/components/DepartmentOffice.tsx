import { BriefcaseBusiness, ListChecks, MessageSquarePlus } from "lucide-react";
import { departments } from "../data/defaultEmployees";
import type { DepartmentId, Employee, TaskReport } from "../types";
import { getAvatarClass } from "./EmployeeCard";

interface DepartmentOfficeProps {
  departmentId: DepartmentId;
  employees: Employee[];
  activeReport?: TaskReport;
}

export default function DepartmentOffice({ departmentId, employees, activeReport }: DepartmentOfficeProps) {
  const department = departments.find((item) => item.id === departmentId);
  const members = employees.filter((employee) => employee.departmentId === departmentId);
  const leadEmployee = members[0];
  const supportingMembers = members.slice(1);
  const teamResult = activeReport?.results.find((item) => item.departmentId === departmentId);
  const teamPrompt = teamResult?.sections[0]?.items[0];

  return (
    <section className="panel office-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Department Office</p>
          <h2>{department?.name}</h2>
        </div>
        <span className="soft-badge">{members.length}명 근무 중</span>
      </div>
      <div className="office-scene">
        <div className="department-staff-zone">
          <div className="office-team-title">
            <strong>{department?.name}</strong>
            <span>{department?.description}</span>
          </div>

          <div className="staff-stage">
            {leadEmployee && (
              <article className="lead-staff-card">
                <div className="desk-avatar-wrap">
                  <div className={`desk-avatar ${getAvatarClass(leadEmployee.id)}`} />
                </div>
                <div className="lead-staff-copy">
                  <div className="lead-staff-header">
                    <div className="lead-staff-name">{leadEmployee.name}</div>
                    <span className="lead-staff-badge">{department?.name}</span>
                  </div>
                  <div className="lead-staff-role">{leadEmployee.title}</div>
                  <em>{teamPrompt ?? leadEmployee.currentTask ?? "새 업무 대기 중"}</em>
                </div>
              </article>
            )}

            {supportingMembers.length > 0 ? (
              <div className="staff-roster" aria-label={`${department?.name} 직원 목록`}>
                {members.map((employee) => (
                  <article className="staff-chip-card" key={employee.id}>
                    <div className={`staff-chip-avatar ${getAvatarClass(employee.id)}`} />
                    <div className="staff-chip-copy">
                      <h4 className="staff-chip-name">{employee.name}</h4>
                      <p className="staff-chip-role">{employee.title}</p>
                    </div>
                    <small className={`status-pill ${employee.status.replace(/\s/g, "-")}`}>
                      {employee.status}
                    </small>
                  </article>
                ))}
              </div>
            ) : leadEmployee ? (
              <article className="solo-team-board">
                <div className="solo-board-block">
                  <strong>이 역할이 하는 일</strong>
                  <p>{leadEmployee.role}</p>
                </div>
                <div className="solo-board-block">
                  <strong>전문 업무</strong>
                  <div className="solo-chip-list">
                    {leadEmployee.specialties.slice(0, 4).map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
                <div className="solo-board-block">
                  <strong>주요 결과물</strong>
                  <ul className="solo-output-list">
                    {leadEmployee.outputs.slice(0, 3).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ) : null}
          </div>
        </div>

        <div className="team-actions" aria-label={`${department?.name} 업무 기능`}>
          <p>업무 기능</p>
          <button><MessageSquarePlus size={17} /> 새 업무 맡기기</button>
          <button><ListChecks size={17} /> 진행 업무 보기</button>
          <button><BriefcaseBusiness size={17} /> 팀 문서함</button>
          {teamResult && (
            <div className="team-focus-card">
              <strong>현재 팀 의견</strong>
              <span>{teamResult.sections[0]?.title}</span>
              <p>{teamPrompt}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
