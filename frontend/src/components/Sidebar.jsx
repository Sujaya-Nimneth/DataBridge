/**
 * Application side navigation, built on Astryx SideNav.
 *
 * AppShell (in App.jsx) owns the responsive frame: above the md breakpoint this
 * SideNav is inline; below it AppShell moves the same nav into a focus-trapping
 * mobile drawer and provides the toggle and the skip link. SideNavItem's
 * isSelected sets aria-current="page", so the current destination is announced
 * rather than carried by colour alone (WCAG 2.2 AA keep).
 *
 * Domain icons (dashboard, database, transfer, chart, users) are not in
 * Astryx's semantic icon set, so the existing react-icons outline SVGs are
 * passed directly as custom icons. They will be revisited when the icon system
 * is consolidated in the primitives phase.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { NavIcon } from '@astryxdesign/core/NavIcon';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Avatar } from '@astryxdesign/core/Avatar';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import {
  HiOutlineViewGrid,
  HiOutlineDatabase,
  HiOutlineSearch,
  HiOutlineSwitchHorizontal,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineLogout,
} from 'react-icons/hi';

const baseNavItems = [
  { path: '/', icon: HiOutlineViewGrid, label: 'Dashboard' },
  { path: '/connections', icon: HiOutlineDatabase, label: 'Connections' },
  { path: '/explorer', icon: HiOutlineSearch, label: 'Data Explorer' },
  { path: '/transfers', icon: HiOutlineSwitchHorizontal, label: 'Transfers' },
  { path: '/monitoring', icon: HiOutlineChartBar, label: 'Monitoring' },
];

function isCurrent(pathname, path) {
  // Nested routes (/transfers/:id, /admin/users) keep their section selected.
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems =
    user?.role === 'admin'
      ? [...baseNavItems, { path: '/admin/users', icon: HiOutlineUsers, label: 'Users' }]
      : baseNavItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <SideNav
      aria-label="Main navigation"
      header={
        <SideNavHeading
          icon={<NavIcon icon={<span className="sidebar-logo">D</span>} />}
          heading="DataBridge"
          subheading="Data Platform"
          headingHref="/"
        />
      }
      footer={
        <HStack gap={2} align="center">
          <Avatar name={user?.full_name || 'User'} size="sm" tooltip={false} />
          <Text type="supporting" color="secondary" maxLines={1}>
            {user?.full_name || '?'} · {user?.role}
          </Text>
          <IconButton
            label="Log out"
            variant="ghost"
            icon={<HiOutlineLogout aria-hidden="true" />}
            onClick={handleLogout}
            tooltip="Log out"
          />
        </HStack>
      }
    >
      <SideNavSection title="Navigation" isHeaderHidden>
        {navItems.map((item) => (
          <SideNavItem
            key={item.path}
            label={item.label}
            icon={item.icon}
            href={item.path}
            isSelected={isCurrent(location.pathname, item.path)}
          />
        ))}
      </SideNavSection>
    </SideNav>
  );
}

export default Sidebar;
