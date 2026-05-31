import Header from "./Header";
import Sidebar from "./Sidebar";
import type { MenuKey } from "../types";
import type { ReactNode } from "react";

interface LayoutProps {
  activeMenu: MenuKey;
  setActiveMenu: (menu: MenuKey) => void;
  officeSummary?: {
    title: string;
    detail: string;
    meta: string[];
  };
  children: ReactNode;
}

export default function Layout({ activeMenu, setActiveMenu, officeSummary, children }: LayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} officeSummary={officeSummary} />
      <div className="workspace">
        <Header />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
