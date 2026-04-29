import { Link, useLocation } from 'react-router-dom';

function BottomNav() {
  const location = useLocation();

  const items = [
    { to: '/plants/new', label: '식물 등록' },
    { to: '/plants', label: '식물 목록' },
    { to: '/history', label: '전체 기록' },
  ];

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 12,
        zIndex: 10,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          background: '#fffdf8',
          border: '1px solid #ece5d7',
          borderRadius: 22,
          padding: 10,
          boxShadow: '0 10px 24px rgba(79, 67, 38, 0.08)',
        }}
      >
        {items.map((item) => {
          const isActive = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                textDecoration: 'none',
                textAlign: 'center',
                padding: '14px 10px',
                borderRadius: 16,
                fontWeight: 800,
                fontSize: 18,
                color: isActive ? '#ffffff' : '#5e6a61',
                background: isActive ? '#8dc7a3' : '#f3efe5',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
import { Link, useLocation } from 'react-router-dom-dom';

function BottomNav() {
  const location = useLocation();

  const items = [
    { to: '/plants/new', label: '식물 등록' },
    { to: '/plants', label: '식물 목록' },
    { to: '/history', label: '전체 기록' },
  ];

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 12,
        zIndex: 10,
        marginTop: 16,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
          background: '#fffdf8',
          border: '1px solid #ece5d7',
          borderRadius: 22,
          padding: 10,
          boxShadow: '0 10px 24px rgba(79, 67, 38, 0.08)',
        }}
      >
        {items.map((item) => {
          const isActive = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                textDecoration: 'none',
                textAlign: 'center',
                padding: '14px 10px',
                borderRadius: 16,
                fontWeight: 800,
                fontSize: 18,
                color: isActive ? '#ffffff' : '#5e6a61',
                background: isActive ? '#8dc7a3' : '#f3efe5',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;