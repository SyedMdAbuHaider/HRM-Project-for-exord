
import React from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  Map, 
  DollarSign, 
  Calendar, 
  ShieldAlert, 
  LogOut,
  UserCircle,
  X,
  ChevronRight
} from 'lucide-react';

const ExordLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0C22.3858 0 0 22.3858 0 50C0 51.5 0.1 53 0.3 54.5H45V45.5H10.5C14.5 25.5 30.5 10 50 10C69.5 10 85.5 25.5 89.5 45.5H55V54.5H99.7C99.9 53 100 51.5 100 50C100 22.3858 77.6142 0 50 0Z" fill="#E31E24"/>
    <path d="M50 100C77.6142 100 100 77.6142 100 50C100 48.5 99.9 47 99.7 45.5H55V54.5H89.5C85.5 74.5 69.5 90 50 90C30.5 90 14.5 74.5 10.5 54.5H45V45.5H0.3C0.1 47 0 48.5 0 50C0 77.6142 22.3858 100 50 100Z" fill="currentColor"/>
  </svg>
);

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isOpen, onClose }) => {
  const { currentUser, logout, theme } = useHRM();

  const adminLinks = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Control Center' },
    { id: 'employees', icon: Users, label: 'Workforce Hub' },
    { id: 'attendance', icon: Clock, label: 'Shift Logs' },
    { id: 'tracking', icon: Map, label: 'Field Mapping' },
    { id: 'payroll', icon: DollarSign, label: 'Remuneration' },
    { id: 'leaves', icon: Calendar, label: 'Request Vault' },
    { id: 'security', icon: ShieldAlert, label: 'Security Protocols' },
  ];

  const employeeLinks = [
    { id: 'portal', icon: UserCircle, label: 'Service Portal' },
    { id: 'attendance', icon: Clock, label: 'Biometric Clock' },
    { id: 'payroll', icon: DollarSign, label: 'Pay Stubs' },
    { id: 'leaves', icon: Calendar, label: 'Leave Center' },
  ];

  const links = currentUser?.role === UserRole.ADMIN ? adminLinks : employeeLinks;

  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 w-72 bg-[#1A1A1B] dark:bg-slate-900 text-white flex flex-col 
      border-r border-white/5 transition-all duration-500 ease-in-out
      md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      <div className="p-8 pb-12 flex items-center justify-between">
        <div className="flex items-center gap-4 group cursor-pointer">
          <ExordLogo className="w-10 h-10 text-white group-hover:rotate-12 transition-transform duration-500" />
          <div className="leading-tight">
            <h1 className="text-xl font-black tracking-tighter text-white font-brand">
              <span className="text-[#E31E24]">Exord</span><br/>
              <span>Online</span>
            </h1>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 rounded-2xl text-slate-400 md:hidden hover:text-white">
          <X size={22} />
        </button>
      </div>

      <div className="px-8 mb-6">
        <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent"></div>
        <p className="text-[9px] text-slate-500 uppercase font-black tracking-[0.3em] mt-6 px-1">
          Secure Core
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {links.map((link) => {
          const isActive = activeView === link.id;
          return (
            <button
              key={link.id}
              onClick={() => {
                setActiveView(link.id);
                if (window.innerWidth < 768) onClose();
              }}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative ${
                isActive 
                  ? 'bg-gradient-to-r from-[#E31E24] to-[#C41217] text-white shadow-xl shadow-red-900/20 translate-x-1' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
              }`}
            >
              <link.icon className={`w-5 h-5 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="font-bold text-[13px] tracking-tight">{link.label}</span>
              {isActive && <ChevronRight size={14} className="ml-auto text-white/60" />}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto p-6 bg-slate-800/20 border-t border-white/5 m-4 rounded-3xl">
        <div className="flex items-center gap-4 mb-6 group cursor-pointer px-1">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-white text-lg border border-white/10">
            {currentUser?.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-black truncate text-white tracking-tight">{currentUser?.name}</p>
            <p className="text-[10px] text-[#E31E24] uppercase font-black tracking-widest mt-1">{currentUser?.id}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-3 py-4 text-slate-400 hover:text-white hover:bg-red-600 rounded-2xl transition-all duration-300 text-[10px] font-black uppercase tracking-[0.2em]"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit Session</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
