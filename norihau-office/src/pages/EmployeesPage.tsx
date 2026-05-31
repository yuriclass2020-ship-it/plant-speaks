import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import EmployeeCard, { getAvatarClass, newHireAvatarOptions } from "../components/EmployeeCard";
import { departments } from "../data/defaultEmployees";
import type { ActivityLog, DepartmentId, Employee, EmployeeStatus } from "../types";

const emptyEmployee: Employee = {
  id: "",
  name: "",
  departmentId: "content",
  title: "",
  role: "",
  specialties: [],
  tone: "",
  outputs: [],
  status: "작업 가능",
  currentTask: "입사 준비 중",
  progress: 0,
  avatar: "hire-mint-bob",
};

interface EmployeesPageProps {
  employees: Employee[];
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  addLog: (message: string, type: ActivityLog["type"]) => void;
}

export default function EmployeesPage({ employees, setEmployees, addLog }: EmployeesPageProps) {
  const [form, setForm] = useState(emptyEmployee);
  const [activeTab, setActiveTab] = useState<"all" | "department" | "hiring">("all");
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentId>("secretary");
  const [showDetails, setShowDetails] = useState(false);

  const resetEmployeeForm = () => {
    setForm(emptyEmployee);
    setShowDetails(false);
  };

  const saveEmployee = () => {
    if (!form.name.trim()) return;
    const employee = { ...form, id: form.id || crypto.randomUUID() };
    setEmployees((current) => {
      const exists = current.some((item) => item.id === employee.id);
      return exists ? current.map((item) => (item.id === employee.id ? employee : item)) : [employee, ...current];
    });
    addLog(`${employee.name} 직원이 ${departments.find((item) => item.id === employee.departmentId)?.name}에 합류했습니다.`, "employee");
    resetEmployeeForm();
    setActiveTab("all");
  };

  return (
    <div className="stack-page">
      <section className="panel project-home-panel">
        <div className="project-home-head">
          <div>
            <p className="eyebrow">AI Staff Room</p>
            <h2>직원실</h2>
          </div>
          <div className="studio-tab-list compact-tabs" role="tablist" aria-label="직원실 탭">
            <button className={activeTab === "all" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("all")}>
              전체 직원
            </button>
            <button className={activeTab === "department" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("department")}>
              부서별
            </button>
            <button className={activeTab === "hiring" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("hiring")}>
              새 직원 추가
            </button>
          </div>
        </div>

        {activeTab === "hiring" ? (
          <div className="compact-project-desk">
            <div className="project-desk-layout">
              <div className="project-desk-editor">
                <section className="project-desk-section">
                  <div className="project-desk-section-head">
                    <h3>기본 정보</h3>
                    <span>이름, 소속 부서, 역할명만 먼저 적어도 시작할 수 있어요.</span>
                  </div>
                  <div className="form-grid compact-form-grid">
                    <label>
                      <span>이름</span>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 세나" />
                    </label>
                    <label>
                      <span>소속 부서</span>
                      <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value as DepartmentId })}>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>{department.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>역할명</span>
                      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 콘텐츠 기획자" />
                    </label>
                    <label>
                      <span>현재 상태</span>
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EmployeeStatus })}>
                        <option>작업 가능</option>
                        <option>작업 중</option>
                        <option>검토 필요</option>
                        <option>회의 중</option>
                        <option>대기 중</option>
                      </select>
                    </label>
                    <label className="full-width">
                      <span>현재 업무</span>
                      <input value={form.currentTask} onChange={(e) => setForm({ ...form, currentTask: e.target.value })} placeholder="예: 입사 준비 중" />
                    </label>
                    <div className="full-width avatar-picker-field">
                      <span>아바타 선택</span>
                      <div className="avatar-picker-grid">
                        {newHireAvatarOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={form.avatar === option.id ? "avatar-picker-option active" : "avatar-picker-option"}
                            onClick={() => setForm({ ...form, avatar: option.id })}
                          >
                            <div className={`employee-photo-avatar avatar-picker-preview ${getAvatarClass(option.id)}`} />
                            <div className="avatar-picker-copy">
                              <strong>{option.name}</strong>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
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
                        <h3>업무 스타일</h3>
                        <span>이 직원이 어떤 방식으로 일하고 말하는지 적어요.</span>
                      </div>
                      <div className="form-grid compact-form-grid">
                        <label className="full-width">
                          <span>역할 설명</span>
                          <textarea value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="이 직원이 맡는 역할을 적어주세요." />
                        </label>
                        <label className="full-width">
                          <span>전문 업무</span>
                          <textarea value={form.specialties.join(", ")} onChange={(e) => setForm({ ...form, specialties: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="예: 놀이 흐름 기획, 교사 문서 지원" />
                        </label>
                        <label className="full-width">
                          <span>말투</span>
                          <textarea value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="예: 차분하고 친절하게 정리해주는 말투" />
                        </label>
                      </div>
                    </section>

                    <section className="project-desk-section">
                      <div className="project-desk-section-head">
                        <h3>결과물 정보</h3>
                        <span>대표님이 이 직원에게 기대하는 산출물을 남겨둡니다.</span>
                      </div>
                      <div className="form-grid compact-form-grid">
                        <label className="full-width">
                          <span>주요 결과물</span>
                          <textarea value={form.outputs.join(", ")} onChange={(e) => setForm({ ...form, outputs: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="예: 기획안, 교사용 문장, 인스타 캡션" />
                        </label>
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
            <div className="project-desk-actions">
              <button className="ghost-button" onClick={resetEmployeeForm}>새 직원으로 시작</button>
              <button className="primary-button" onClick={saveEmployee}>직원 저장</button>
            </div>
          </div>
        ) : (
          <div className="project-home-summary">
            <span>전체 직원 {employees.length}</span>
            <span>작업 가능 {employees.filter((employee) => employee.status === "작업 가능").length}</span>
            <span>작업 중 {employees.filter((employee) => employee.status === "작업 중").length}</span>
          </div>
        )}
      </section>

      {activeTab === "all" && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">All Staff</p>
              <h2>전체 직원 현황</h2>
            </div>
            <span className="soft-badge">{employees.length}명</span>
          </div>
          <div className="office-room compact-office compact-employee-grid">
            {employees.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        </section>
      )}

      {activeTab === "department" && (
        <>
          <section className="panel department-filter-panel">
            <div className="department-filter-tabs" role="tablist" aria-label="부서 선택">
              {departments.map((department) => (
                <button
                  key={department.id}
                  className={selectedDepartment === department.id ? "department-filter-chip active" : "department-filter-chip"}
                  onClick={() => setSelectedDepartment(department.id)}
                >
                  {department.name}
                </button>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Department Staff</p>
                <h2>{departments.find((department) => department.id === selectedDepartment)?.name}</h2>
              </div>
              <span className="soft-badge">
                {employees.filter((employee) => employee.departmentId === selectedDepartment).length}명
              </span>
            </div>
            <div className="office-room compact-office compact-employee-grid">
              {employees
                .filter((employee) => employee.departmentId === selectedDepartment)
                .map((employee) => (
                  <EmployeeCard key={employee.id} employee={employee} />
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
