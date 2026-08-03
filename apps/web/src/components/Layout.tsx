import { useState, type ReactNode } from 'react';
import {
  Activity,
  Bot,
  ChevronLeft,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PhoneCall,
  Radio,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useRouter } from '../context/RouterContext.js';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/queues', label: 'Queues & routing', icon: Headphones },
  { to: '/calls', label: 'Call operations', icon: PhoneCall },
  { to: '/automations', label: 'Automations', icon: Bot },
  { to: '/network', label: 'Network access', icon: Network },
  { to: '/audit', label: 'Audit trail', icon: ClipboardList },
];

export function Layout({ children }: { children: ReactNode }) {
  const { token, user, logout } = useAuth();
  const { path, navigate } = useRouter();
  const liveState = useLiveUpdates(token);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <button
        className="mobile-menu"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu size={22} />
      </button>
      {open ? (
        <button
          className="scrim"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">
            <Radio size={22} />
          </div>
          <div className="brand-copy">
            <strong>RelayOps</strong>
            <span>Control Plane</span>
          </div>
          <button
            className="mobile-close"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="environment-pill">
          <span /> Synthetic demo environment
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon, end }) => {
            const active = end ? path === to : path === to || path.startsWith(`${to}/`);
            return (
              <a
                key={to}
                href={to}
                className={active ? 'active' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(to);
                  setOpen(false);
                }}
                title={collapsed ? label : undefined}
              >
                <Icon size={19} />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="live-status">
            <Activity size={15} />
            <span className={`live-dot live-${liveState}`} />{' '}
            <span>{liveState === 'connected' ? 'Live updates' : 'Reconnecting'}</span>
          </div>
          <div className="user-card">
            <div className="avatar">{user.displayName.slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{user.displayName}</strong>
              <span>{user.role}</span>
            </div>
            <button type="button" onClick={logout} aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
          <button
            className="collapse-button"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
          >
            <ChevronLeft size={17} />
            <span>Collapse navigation</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <div className="security-banner">
          <ShieldCheck size={15} /> Provider-neutral control plane · no call audio is stored
        </div>
        {children}
      </main>
    </div>
  );
}
