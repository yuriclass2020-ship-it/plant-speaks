import { BriefcaseBusiness, CalendarDays, ClipboardList, Coins, History, Settings, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import type { MenuKey } from "../types";

const menus: { key: MenuKey; label: string; icon: ReactNode }[] = [
  { key: "today", label: "오피스 운영실", icon: <BriefcaseBusiness size={18} /> },
  { key: "projects", label: "프로젝트 룸", icon: <ClipboardList size={18} /> },
  { key: "employees", label: "AI 직원실", icon: <UsersRound size={18} /> },
  { key: "finance", label: "운영 / 재무", icon: <Coins size={18} /> },
  { key: "records", label: "회의 기록", icon: <History size={18} /> },
  { key: "settings", label: "오피스 설정", icon: <Settings size={18} /> },
];

interface SidebarProps {
  activeMenu: MenuKey;
  setActiveMenu: (menu: MenuKey) => void;
  officeSummary?: {
    title: string;
    detail: string;
    meta: string[];
  };
}

export default function Sidebar({ activeMenu, setActiveMenu, officeSummary }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">N</div>
        <div>
          <strong>Norihau</strong>
          <span>AI Office</span>
        </div>
      </div>
      <nav className="menu-list">
        {menus.map((menu) => (
          <button
            className={activeMenu === menu.key ? "menu-item active" : "menu-item"}
            key={menu.key}
            onClick={() => setActiveMenu(menu.key)}
          >
            {menu.icon}
            <span>{menu.label}</span>
          </button>
        ))}
      </nav>
      {officeSummary && (
        <section className="sidebar-summary-card">
          <div className="sidebar-summary-head">
            <CalendarDays size={16} />
            <strong>오늘의 오피스</strong>
          </div>
          <h3>{officeSummary.title}</h3>
          <p>{officeSummary.detail}</p>
          <div className="sidebar-summary-meta">
            {officeSummary.meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
