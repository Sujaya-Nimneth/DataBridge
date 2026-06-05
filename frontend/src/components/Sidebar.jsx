/**
 * Sidebar navigation component with active state indicators.
 */

import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineViewGrid,
  HiOutlineDatabase,
  HiOutlineSearch,
  HiOutlineSwitchHorizontal,
  HiOutlineChartBar,
  HiOutlineLogout,
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <aside className="sidebar" id="main-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">D</div>
        <div className="sidebar-brand">
          <h1>DataBridge</h1>
          <span>Data Platform</span>
        </div>
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
              <item.icon />
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div className="user-details">
            <div className="user-name">{user?.full_name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button
            className="btn-ghost btn-icon"
            onClick={handleLogout}
            title="Logout"
            id="btn-logout"
            style={{ marginLeft: 'auto' }}
          >
            <HiOutlineLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
