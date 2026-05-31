import type { TaskReport } from "../types";

export default function TaskResultReport({ report }: { report?: TaskReport }) {
  if (!report) {
    return (
      <section className="panel report-panel empty-report">
        <p className="eyebrow">Team Report</p>
        <h2>업무 결과 보고서</h2>
        <p>업무를 지시하면 세나가 관련 부서별 mock 결과를 보고서로 정리합니다.</p>
      </section>
    );
  }

  return (
    <section className="panel report-panel">
      <p className="eyebrow">Team Report</p>
      <h2>{report.task.projectName} 업무 결과 보고서</h2>
      <p className="report-summary">{report.task.summary}</p>
      <div className="report-grid">
        {report.results.map((result) => (
          <article key={result.departmentId} className="report-card">
            <h3>{result.departmentName}</h3>
            {result.sections.map((section) => (
              <div key={section.title}>
                <strong>{section.title}</strong>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
