/**
 * Sidebar navigation component with active state indicators.
 * On small screens it becomes an off-canvas drawer opened from the top bar.
 */

import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineViewGrid,
  HiOutlineDatabase,
  HiOutlineSearch,
  HiOutlineSwitchHorizontal,
  HiOutlineChartBar,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX,
} from 'react-icons/hi';

const navItems = [
  { path: '/', icon: HiOutlineViewGrid, label: 'Dashboard' },
  { path: '/connections', icon: HiOutlineDatabase, label: 'Connections' },
  { path: '/explorer', icon: HiOutlineSearch, label: 'Data Explorer' },
  { path: '/transfers', icon: HiOutlineSwitchHorizontal, label: 'Transfers' },
  { path: '/monitoring', icon: HiOutlineChartBar, label: 'Monitoring' },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close on Escape and lock background scrolling while open.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('no-scroll');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('no-scroll');
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <>
      <header className="mobile-topbar">
        <button
          type="button"
          className="btn btn-ghost btn-icon mobile-menu-button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="main-sidebar"
          id="btn-open-menu"
        >
          <HiOutlineMenu />
        </button>
        <div className="mobile-topbar-brand">
          <span className="sidebar-logo">D</span>
          <span>DataBridge</span>
        </div>
      </header>

      {menuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${menuOpen ? 'open' : ''}`}
        id="main-sidebar"
        aria-label="Main navigation"
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">D</div>
          <div className="sidebar-brand">
            <h1>DataBridge</h1>
            <span>Data Platform</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <HiOutlineX />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span className="nav-item-icon">
                <item.icon aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-details">
              <div className="user-name">{user?.full_name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button
              type="button"
              className="btn-ghost btn-icon"
              onClick={handleLogout}
              title="Logout"
              aria-label="Log out"
              id="btn-logout"
              style={{ marginLeft: 'auto' }}
            >
              <HiOutlineLogout />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
