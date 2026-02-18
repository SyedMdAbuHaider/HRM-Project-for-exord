
import React, { useState, useEffect } from 'react';
import { HRMProvider, useHRM } from './store';
import { UserRole } from './types';
import { DEPARTMENTS } from './constants';
import Sidebar from './components/Sidebar';
import AdminDashboard from './views/AdminDashboard';
import EmployeePortal from './views/EmployeePortal';
import LiveTracking from './views/LiveTracking';
import SecurityLogs from './views/SecurityLogs';
import WorkforceView from './views/WorkforceView';
import PayrollView from './views/PayrollView';
import LeavesView from './views/LeavesView';
import { ShieldAlert, KeyRound, Mail, Globe, Menu, X, Bell, Search, User as UserIcon, CheckCircle2, ArrowRight, Hash, Sun, Moon, Briefcase } from 'lucide-react';

const ExordLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 0C22.3858 0 0 22.3858 0 50C0 51.5 0.1 53 0.3 54.5H45V45.5H10.5C14.5 25.5 30.5 10 50 10C69.5 10 85.5 25.5 89.5 45.5H55V54.5H99.7C99.9 53 100 51.5 100 50C100 22.3858 77.6142 0 50 0Z" fill="#E31E24"/>
    <path d="M50 100C77.6142 100 100 77.6142 100 50C100 48.5 99.9 47 99.7 45.5H55V54.5H89.5C85.5 74.5 69.5 90 50 90C30.5 90 14.5 74.5 10.5 54.5H45V45.5H0.3C0.1 47 0 48.5 0 50C0 77.6142 22.3858 100 50 100Z" className="fill-[#1A1A1B] dark:fill-white transition-colors"/>
  </svg>
);

const MainApp: React.FC = () => {
  const { currentUser, login, register, theme, toggleTheme } = useHRM();
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState(''); 
  const [email, setEmail] = useState(''); 
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE);
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // When user logs in, set initial view
  useEffect(() => {
    if (currentUser) {
      setActiveView(currentUser.role === UserRole.ADMIN ? 'dashboard' : 'portal');
    }
  }, [currentUser]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isRegistering) {
      const res = await register(name, email, password, userId, department);
      if (res.success) {
        setSuccessMsg(res.message);
        setIsRegistering(false);
        setIdentifier(userId.toUpperCase());
      } else {
        setError(res.message);
      }
    } else {
      const success = await login(identifier, password, role);
      if (!success) setError('Access Denied. Node credentials invalid.');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row font-inter overflow-hidden transition-colors duration-500">
        <div className="hidden lg:flex lg:w-1/2 bg-white dark:bg-slate-900 p-16 flex-col justify-center items-center relative overflow-hidden border-r border-slate-300 dark:border-slate-800">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/5 rounded-full blur-[120px] -mr-96 -mt-96"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <ExordLogo className="w-48 h-48 drop-shadow-2xl mb-8" />
            <h1 className="text-6xl font-black tracking-tighter flex items-baseline">
              <span className="text-[#E31E24]">Exord</span>
              <span className="text-[#1A1A1B] dark:text-white ml-2 transition-colors">Online</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium italic tracking-widest mt-4 uppercase">EXTRAORDINARY INTERNET EXPERIENCE...</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto custom-scrollbar transition-colors">
          <button onClick={toggleTheme} className="absolute top-6 right-6 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-300 dark:border-slate-700 transition-all hover:scale-110 active:scale-95 z-50">
            {theme === 'light' ? <Moon size={24} className="text-slate-900" /> : <Sun size={24} className="text-amber-400" />}
          </button>

          <div className="w-full max-w-md space-y-8 animate-[fadeIn_0.5s_ease-out]">
            <div className="lg:hidden flex flex-col items-center mb-8">
               <ExordLogo className="w-24 h-24 mb-4" />
               <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Exord Online</h2>
            </div>

            <div className="space-y-1">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">
                {isRegistering ? 'Provision New Node' : 'Initialize Node'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {isRegistering ? 'Enter node identification details.' : 'Authenticate via EXXXX or internal email.'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isRegistering && (
                <div className="p-1 bg-slate-200/80 dark:bg-slate-800 rounded-2xl flex gap-1 shadow-inner border border-slate-300 dark:border-slate-700">
                  <button type="button" onClick={() => setRole(UserRole.EMPLOYEE)} className={`flex-1 py-3 px-4 rounded-[0.9rem] text-xs font-black uppercase tracking-widest transition-all ${role === UserRole.EMPLOYEE ? 'bg-white dark:bg-slate-700 text-[#E31E24] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Staff</button>
                  <button type="button" onClick={() => setRole(UserRole.ADMIN)} className={`flex-1 py-3 px-4 rounded-[0.9rem] text-xs font-black uppercase tracking-widest transition-all ${role === UserRole.ADMIN ? 'bg-white dark:bg-slate-700 text-[#E31E24] shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Admin</button>
                </div>
              )}

              <div className="space-y-3">
                {isRegistering ? (
                  <>
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Legal Name" className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all shadow-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative group">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                        <input type="text" required value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="E1001" className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all shadow-sm" />
                      </div>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all shadow-sm" />
                      </div>
                    </div>
                    <div className="relative group">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors pointer-events-none" />
                      <select required value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all cursor-pointer shadow-sm appearance-none">
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                    <input type="text" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="EXXXX or Email" className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all shadow-sm" />
                  </div>
                )}
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#E31E24] transition-colors" />
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Access Password" className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all shadow-sm" />
                </div>
              </div>

              {error && <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-widest rounded-2xl border-2 border-rose-100 dark:border-rose-900/40 flex items-center gap-3 animate-pulse"><ShieldAlert size={14} /> {error}</div>}
              {successMsg && <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-widest rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3"><CheckCircle2 size={14} /> {successMsg}</div>}

              <button type="submit" className="w-full py-5 bg-slate-950 dark:bg-white dark:text-slate-900 hover:bg-[#E31E24] dark:hover:bg-[#E31E24] dark:hover:text-white text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl transition-all duration-300 flex items-center justify-center gap-2">
                {isRegistering ? 'Sync Provisioning' : 'Access Node'} <ArrowRight size={16} />
              </button>

              <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMsg(''); }} className="w-full text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] hover:text-[#E31E24] transition-colors">
                {isRegistering ? 'Identified node already exists?' : 'New infrastructure request?'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <AdminDashboard />;
      case 'employees': return <WorkforceView />;
      case 'portal': return <EmployeePortal />;
      case 'tracking': return <LiveTracking />;
      case 'security': return <SecurityLogs />;
      case 'payroll': return <PayrollView />;
      case 'leaves': return <LeavesView />;
      case 'attendance': 
        return currentUser.role === UserRole.ADMIN ? <AdminDashboard /> : <EmployeePortal />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row transition-colors duration-500 overflow-hidden">
      <Sidebar activeView={activeView} setActiveView={setActiveView} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden transition-all duration-500" onClick={() => setIsSidebarOpen(false)} />}

      <main className="flex-1 flex flex-col min-h-screen transition-all duration-500 md:ml-72 relative">
        <header className="sticky top-0 z-30 px-6 py-5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-slate-300 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl md:hidden border-2 border-slate-300 dark:border-slate-700">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight flex items-center gap-3 font-jakarta">
              {activeView.replace('-', ' ')}
              <div className="w-2 h-2 rounded-full bg-[#E31E24] animate-pulse"></div>
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <button onClick={toggleTheme} className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all border-2 border-slate-300 dark:border-slate-700 shadow-sm">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} className="text-amber-400" />}
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-300 dark:border-slate-700">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none font-jakarta">{currentUser.name}</p>
                <p className="text-[10px] text-[#E31E24] font-black uppercase tracking-widest mt-1.5">{currentUser.id}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 dark:bg-[#E31E24] text-white flex items-center justify-center font-black text-lg shadow-xl ring-2 ring-slate-200 dark:ring-white/10">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-10 max-w-[1600px] mx-auto w-full overflow-y-auto custom-scrollbar">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HRMProvider>
      <MainApp />
    </HRMProvider>
  );
};

export default App;
