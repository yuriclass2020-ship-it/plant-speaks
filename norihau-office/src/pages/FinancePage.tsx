import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { calculateProductionCost, getMonthlyOperatingCost } from "../services/financeEngine";
import type { ActivityLog, ProductionEstimate, Subscription } from "../types";

const emptyEstimate: ProductionEstimate = {
  projectName: "식물이 말해요",
  planningHours: 2,
  designHours: 2,
  developmentHours: 5,
  marketingHours: 1,
  hourlyRate: 30000,
};

interface FinancePageProps {
  subscriptions: Subscription[];
  setSubscriptions: Dispatch<SetStateAction<Subscription[]>>;
  addLog: (message: string, type: ActivityLog["type"]) => void;
}

export default function FinancePage({ subscriptions, setSubscriptions, addLog }: FinancePageProps) {
  const [toolName, setToolName] = useState("");
  const [monthlyCost, setMonthlyCost] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [estimate, setEstimate] = useState(emptyEstimate);
  const [activeTab, setActiveTab] = useState<"overview" | "subscriptions" | "calculator">("overview");
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(false);
  const [showCalculatorDetails, setShowCalculatorDetails] = useState(false);
  const result = calculateProductionCost(estimate);
  const monthlyOperatingCost = getMonthlyOperatingCost(subscriptions);
  const previousMonthCost = subscriptions.slice(1).reduce((sum, item) => sum + item.monthlyCost, 0);
  const costDiff = monthlyOperatingCost - previousMonthCost;
  const costDiffLabel =
    subscriptions.length <= 1
      ? "이번 달부터 운영비 추적이 시작됐어요."
      : costDiff > 0
        ? `지난달 추정치보다 ${costDiff.toLocaleString()}원 늘었어요.`
        : costDiff < 0
          ? `지난달 추정치보다 ${Math.abs(costDiff).toLocaleString()}원 줄었어요.`
          : "지난달 추정치와 비슷한 수준이에요.";
  const highestSubscription = subscriptions.reduce<Subscription | null>(
    (highest, current) => (highest === null || current.monthlyCost > highest.monthlyCost ? current : highest),
    null,
  );
  const financeAlerts = [
    highestSubscription
      ? `${highestSubscription.toolName}이 가장 큰 비용이에요. 사용 빈도를 한 번 점검해보세요.`
      : "아직 등록된 고정 구독비가 없어요.",
    monthlyOperatingCost >= 150000
      ? "월 운영비가 15만원을 넘어서고 있어요. 이번 달 우선 도구를 추려보면 좋아요."
      : "현재 운영비는 비교적 안정적인 편이에요.",
    result.totalCost >= 400000
      ? `${estimate.projectName} 제작비가 큰 편이라, 범위를 나눠 진행해도 좋겠어요.`
      : `${estimate.projectName}는 현재 범위 안에서 무난하게 진행 가능한 수준이에요.`,
  ];

  const saveSubscription = () => {
    if (!toolName.trim()) return;
    const item = { id: crypto.randomUUID(), toolName, monthlyCost, purpose };
    setSubscriptions((current) => [item, ...current]);
    addLog(`${toolName} 구독비가 등록되었습니다.`, "finance");
    setToolName("");
    setMonthlyCost(0);
    setPurpose("");
    setShowSubscriptionDetails(false);
  };

  return (
    <div className="stack-page">
      <section className="panel finance-panel">
        <div className="project-home-head">
          <div>
            <p className="eyebrow">Operations & Finance</p>
            <h2>운영 / 재무</h2>
          </div>
          <div className="studio-tab-list compact-tabs" role="tablist" aria-label="운영 재무 탭">
            <button className={activeTab === "overview" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("overview")}>
              운영 요약
            </button>
            <button className={activeTab === "subscriptions" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("subscriptions")}>
              구독 관리
            </button>
            <button className={activeTab === "calculator" ? "studio-tab active" : "studio-tab"} onClick={() => setActiveTab("calculator")}>
              제작비 계산
            </button>
          </div>
        </div>

        <div className="finance-summary-grid">
          <article className="finance-summary-card">
            <span>이번 달 구독비</span>
            <strong>{monthlyOperatingCost.toLocaleString()}원</strong>
            <p>{subscriptions.length}개의 운영 도구를 사용 중이에요.</p>
          </article>
          <article className="finance-summary-card">
            <span>최근 제작비 계산</span>
            <strong>{result.totalCost.toLocaleString()}원</strong>
            <p>{estimate.projectName} 기준 예상 제작비예요.</p>
          </article>
          <article className="finance-summary-card">
            <span>가장 큰 비용</span>
            <strong>{highestSubscription ? highestSubscription.toolName : "등록 전"}</strong>
            <p>{highestSubscription ? `${highestSubscription.monthlyCost.toLocaleString()}원 / ${highestSubscription.purpose}` : "아직 등록된 구독비가 없어요."}</p>
          </article>
        </div>

        {activeTab === "overview" && (
          <div className="finance-tab-layout">
            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>운영 요약</h3>
                <span>숫자를 빠르게 보고 이번 달 부담을 판단하는 공간이에요.</span>
              </div>
              <div className="finance-overview-list">
                <article>
                  <strong>월 운영비</strong>
                  <span>{monthlyOperatingCost.toLocaleString()}원</span>
                </article>
                <article>
                  <strong>구독 도구 수</strong>
                  <span>{subscriptions.length}개</span>
                </article>
                <article>
                  <strong>예상 제작 시간</strong>
                  <span>{result.totalHours}시간</span>
                </article>
              </div>
            </section>

            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>이번 달 체크 포인트</h3>
                <span>대표님이 바로 판단할 수 있게 핵심만 남겼어요.</span>
              </div>
              <ul className="compact-list finance-focus-list">
                <li>가장 큰 구독비는 {highestSubscription ? `${highestSubscription.toolName}` : "아직 없음"} 입니다.</li>
                <li>{estimate.projectName}의 예상 제작비는 {result.totalCost.toLocaleString()}원이에요.</li>
                <li>운영비가 커지기 전, 사용 빈도가 낮은 도구를 점검해보세요.</li>
              </ul>
            </section>

            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>이번 달 비용 변화</h3>
                <span>이전 달 추정치와 비교한 간단한 흐름이에요.</span>
              </div>
              <div className="finance-change-card">
                <strong>{costDiff >= 0 ? "+" : "-"}{Math.abs(costDiff).toLocaleString()}원</strong>
                <p>{costDiffLabel}</p>
              </div>
            </section>

            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>비용 주의 알림</h3>
                <span>지금 챙기면 좋은 운영 포인트를 모아봤어요.</span>
              </div>
              <ul className="compact-list finance-alert-list">
                {financeAlerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {activeTab === "subscriptions" && (
          <div className="finance-tab-layout">
            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>구독 등록</h3>
                <span>기본 비용부터 먼저 적고, 용도는 필요할 때만 열어보세요.</span>
              </div>
              <div className="form-grid single finance-form-grid">
                <label>
                  <span>도구명</span>
                  <input value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="예: ChatGPT Plus" />
                </label>
                <label>
                  <span>월 비용</span>
                  <input type="number" value={monthlyCost} onChange={(e) => setMonthlyCost(Number(e.target.value))} placeholder="예: 29000" />
                </label>
              </div>
              <button
                type="button"
                className="ghost-button detail-toggle"
                onClick={() => setShowSubscriptionDetails((current) => !current)}
              >
                {showSubscriptionDetails ? "세부 입력 접기" : "세부 입력 펼치기"}
              </button>
              {showSubscriptionDetails && (
                <div className="form-grid single finance-form-grid finance-detail-grid">
                  <label>
                    <span>용도</span>
                    <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="예: 기획 회의, 디자인 시안, 개발 보조" />
                  </label>
                </div>
              )}
              <button className="primary-button" onClick={saveSubscription}>구독비 등록</button>
            </section>

            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>등록된 구독비</h3>
                <span>매달 나가는 비용을 한눈에 확인해요.</span>
              </div>
              <div className="subscription-list compact-subscription-list">
                {subscriptions.map((item) => (
                  <article key={item.id}>
                    <strong>{item.toolName}</strong>
                    <span>{item.monthlyCost.toLocaleString()}원</span>
                    <small>{item.purpose}</small>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "calculator" && (
          <div className="finance-tab-layout">
            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>제작비 입력</h3>
                <span>핵심 숫자만 먼저 넣고, 나머지 시간은 선택 입력으로 펼쳐볼 수 있어요.</span>
              </div>
              <div className="form-grid single finance-form-grid">
                <label>
                  <span>프로젝트명</span>
                  <input value={estimate.projectName} onChange={(e) => setEstimate({ ...estimate, projectName: e.target.value })} placeholder="예: 식물이 말해요" />
                </label>
                <label>
                  <span>개발 시간</span>
                  <input type="number" value={estimate.developmentHours} onChange={(e) => setEstimate({ ...estimate, developmentHours: Number(e.target.value) })} placeholder="예: 5" />
                </label>
                <label>
                  <span>시간당 단가</span>
                  <input type="number" value={estimate.hourlyRate} onChange={(e) => setEstimate({ ...estimate, hourlyRate: Number(e.target.value) })} placeholder="예: 30000" />
                </label>
              </div>
              <button
                type="button"
                className="ghost-button detail-toggle"
                onClick={() => setShowCalculatorDetails((current) => !current)}
              >
                {showCalculatorDetails ? "세부 입력 접기" : "세부 입력 펼치기"}
              </button>
              {showCalculatorDetails && (
                <div className="form-grid single finance-form-grid finance-detail-grid">
                  <div className="finance-detail-note">아래 시간은 더 정확한 제작비 계산이 필요할 때만 입력해도 됩니다.</div>
                  <label>
                    <span>기획 시간</span>
                    <input type="number" value={estimate.planningHours} onChange={(e) => setEstimate({ ...estimate, planningHours: Number(e.target.value) })} placeholder="예: 2" />
                  </label>
                  <label>
                    <span>디자인 시간</span>
                    <input type="number" value={estimate.designHours} onChange={(e) => setEstimate({ ...estimate, designHours: Number(e.target.value) })} placeholder="예: 2" />
                  </label>
                  <label>
                    <span>홍보 시간</span>
                    <input type="number" value={estimate.marketingHours} onChange={(e) => setEstimate({ ...estimate, marketingHours: Number(e.target.value) })} placeholder="예: 1" />
                  </label>
                </div>
              )}
            </section>

            <section className="finance-block">
              <div className="project-desk-section-head">
                <h3>계산 결과</h3>
                <span>총 시간과 예상 제작비를 바로 확인해요.</span>
              </div>
              <div className="estimate-result finance-estimate-result">
                <span>총 작업 시간</span>
                <strong>{result.totalHours}시간</strong>
                <span>예상 제작비</span>
                <strong>{result.totalCost.toLocaleString()}원</strong>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
