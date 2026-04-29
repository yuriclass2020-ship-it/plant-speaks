import { Outlet } from 'react-router-dom-dom';
import BottomNav from './BottomNav';

function AppLayout() {
  return (
    <div className="app-shell">
      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">식물이 말해요</h1>
          <p className="app-subtitle">유아교육 현장에서 사용하는 식물 기록 앱</p>
        </header>

        <main style={{ paddingBottom: 12 }}>
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

export default AppLayout;
