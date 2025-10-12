// src/components/Sidebar.js
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  Home, 
  Calendar, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  Smartphone,
  Monitor,
  ChevronLeft,
  ChevronRight,
  CheckSquare
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { Settings, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

const Sidebar = ({ isCollapsed, setIsCollapsed }) => {
  const router = useRouter();
  const [profile, setProfile] = React.useState(null);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingProfile(true);
      try {
        const me = await fetch('/api/auth/me');
        if (!mounted) return;
        if (!me.ok) {
          // Not authenticated; leave null profile
          return;
        }
        const mj = await me.json();
        if (mj && mj.authenticated) {
          setProfile({ name: mj.name, email: mj.email, avatarColor: '#7c3aed' });
        }
      } catch (e) {
        // ignore; retain fallback
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  
  const menuItems = [
    {
      icon: Home,
      label: 'Overview',
      href: '/overview',
      active: router.pathname === '/overview'
    },
    {
      icon: Calendar,
      label: 'Calendar',
      href: '/calendar',
      active: router.pathname === '/calendar'
    },
    {
      icon: Clock,
      label: 'Timetable',
      href: '/timetable',
      active: router.pathname === '/timetable'
    },
    {
      icon: GraduationCap,
      label: 'Grades',
      href: '/grades',
      active: router.pathname === '/grades'
    },
    {
      icon: BookOpen,
      label: 'Modules',
      href: '/modules',
      active: router.pathname === '/modules'
    },
    {
      icon: CheckSquare,
      label: 'Attendance',
      href: '/attendance',
      active: router.pathname === '/attendance'
    },
  ];

  return (
    // Make the sidebar occupy full height and be sticky so it stays visible on scroll
    // Use the .site-sidebar rule so the look matches the page header and card surfaces
    <aside
      className={`site-sidebar border-r flex flex-col transition-all duration-300 bg-white dark:bg-transparent`}
      style={{ position: 'sticky', top: 0, height: '100vh', width: isCollapsed ? 56 : 220 }}
      aria-hidden={false}
    >
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-white/6">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-xl font-semibold text-indigo-700 dark:text-indigo-300" style={{ letterSpacing: '-0.5px' }}>
              University Planner
            </h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 focus-ring"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 160px)' }} aria-label="Main navigation">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <div
                    className={`
                      flex items-center ${isCollapsed ? 'px-0' : 'px-3'} py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                      ${item.active
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800 shadow-sm'
                        : 'text-gray-700 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-white/6 hover:text-gray-900 dark:hover:text-white'
                      }
                      ${isCollapsed ? 'justify-center' : 'justify-start'}
                    `}
                  >
                      <Icon className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} text-gray-600 dark:text-slate-300`} aria-hidden />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: user profile & settings */}
      <div className="p-4 border-t border-gray-100 dark:border-white/6">
        {!isCollapsed ? (
          <ProfilePanel profile={profile} loading={loadingProfile} />
        ) : (
          <div className="flex justify-center">
            <CollapsedProfileButton profile={profile} />
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

function ProfilePanel({ profile, loading }) {
  const p = profile || { name: 'Demo User', email: 'demo@university.edu', avatarColor: '#7c3aed' };
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
      >
        <Avatar name={p.name} color={p.avatarColor} size={40} />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
            {loading ? 'Loading…' : p.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{p.email}</div>
        </div>
        <Settings className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.email}</p>
          </div>
          <div className="py-1">
            <a
              role="menuitem"
              href="/profile"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <User className="w-4 h-4" />
              Profile
            </a>
            <a
              role="menuitem"
              href="/settings"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </a>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 py-1">
            <button
              onClick={async () => {
                try {
                  try { await fetch('/api/auth/local-signout', { method: 'POST' }); } catch (e) { }
                  await signOut({ callbackUrl: '/landing' });
                } catch (e) { window.location.href = '/signout'; }
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CollapsedProfileButton({ profile }) {
  const p = profile || { avatarColor: '#7c3aed', name: 'User' };
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef(null);
  const popRef = React.useRef(null);

  React.useEffect(() => {
    function onDoc(e) {
      if (!open) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        aria-label="User menu"
        title={p.name}
        className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Avatar name={p.name} color={p.avatarColor} size={32} />
      </button>
      {open && (
        <div 
          ref={popRef} 
          role="menu" 
          aria-label="User menu" 
          className="absolute bottom-12 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ minWidth: 200, zIndex: 50 }}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.email || 'demo@university.edu'}</p>
          </div>
          <div className="py-1">
            <a 
              role="menuitem" 
              href="/profile" 
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <User className="w-4 h-4" />
              Profile
            </a>
            <a 
              role="menuitem" 
              href="/settings" 
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </a>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 py-1">
            <button 
              role="menuitem" 
              onClick={async () => { 
                try { 
                  try { await fetch('/api/auth/local-signout', { method: 'POST' }); } catch (e) { } 
                  await signOut({ callbackUrl: '/landing' }); 
                } catch (e) { window.location.href = '/signout'; } 
              }} 
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}