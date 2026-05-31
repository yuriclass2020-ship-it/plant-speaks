import { Bell, CalendarDays } from "lucide-react";

export default function Header() {
  return (
    <header className="top-header">
      <div className="header-copy">
        <p className="eyebrow">Norihau Office</p>
        <h1>대표님, 좋은 아침입니다!</h1>
        <p className="header-subcopy">오늘 안건을 세나와 정리하고, AI 직원들과 의견을 나누며 프로젝트를 전진시켜보세요.</p>
      </div>
      <div className="header-actions">
        <button className="icon-button" aria-label="알림">
          <Bell size={19} />
        </button>
        <button className="icon-button" aria-label="캘린더">
          <CalendarDays size={19} />
        </button>
        <div className="profile-chip">
          <span>대표님</span>
          <div className="profile-avatar">CEO</div>
        </div>
      </div>
    </header>
  );
}
