
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
  Globe,
  X,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, isOpen, onClose }) => {
  const { currentUser, logout } = useHRM();

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
      fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white flex flex-col 
      border-r border-white/5 transition-all duration-500 ease-in-out
      md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Sidebar Header */}
      <div className="p-8 pb-12 flex items-center justify-between">
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="w-12 h-12 rounded-[1.25rem] bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-900/40 group-hover:rotate-12 transition-transform duration-500">
            <Globe className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white font-jakarta">Exord</h1>
            <p className="text-red-500 text-[9px] font-black uppercase tracking-[0.4em] -mt-1 leading-none">Online</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-3 bg-white/5 rounded-2xl text-slate-400 md:hidden hover:text-white transition-colors"
        >
          <X size={22} />
        </button>
      </div>

      <div className="px-8 mb-6">
        <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent"></div>
        <p className="text-[9px] text-slate-500 uppercase font-black tracking-[0.3em] mt-6 px-1">
          System Modules
        </p>
      </div>

      {/* Nav Links */}
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
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-xl shadow-red-900/20 translate-x-1' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
              }`}
            >
              <div className={`transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:rotate-6'}`}>
                <link.icon className="w-5 h-5" />
              </div>
              <span className="font-bold text-[13px] tracking-tight">{link.label}</span>
              {isActive ? (
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-white/40"></div>
                  <ChevronRight size={14} className="text-white/60" />
                </div>
              ) : (
                <ChevronRight size={14} className="ml-auto opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-600" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="mt-auto p-6 bg-slate-900/40 border-t border-white/5 m-4 rounded-3xl">
        <div className="flex items-center gap-4 mb-6 group cursor-pointer px-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center font-black text-white text-lg shadow-xl group-hover:scale-105 transition-transform duration-300 border border-white/5">
            {currentUser?.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-black truncate text-white tracking-tight font-jakarta">{currentUser?.name}</p>
            <p className="text-[10px] text-red-500 uppercase font-black tracking-widest mt-1 opacity-80">{currentUser?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-3 py-4 text-slate-400 hover:text-white hover:bg-red-600 rounded-2xl transition-all duration-300 text-[10px] font-black uppercase tracking-[0.2em] group"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Terminate Session</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
