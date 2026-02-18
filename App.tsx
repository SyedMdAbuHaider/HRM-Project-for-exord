
import React, { useState, useEffect } from 'react';
import { HRMProvider, useHRM } from './store';
import { UserRole } from './types';
import Sidebar from './components/Sidebar';
import AdminDashboard from './views/AdminDashboard';
import EmployeePortal from './views/EmployeePortal';
import LiveTracking from './views/LiveTracking';
import SecurityLogs from './views/SecurityLogs';
import WorkforceView from './views/WorkforceView';
import { ShieldAlert, KeyRound, Mail, Globe, Menu, X, Bell, Search, User as UserIcon, CheckCircle2, ArrowRight } from 'lucide-react';

const MainApp: React.FC = () => {
  const { currentUser, login, register } = useHRM();
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.EMPLOYEE);
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Close sidebar on mobile when view changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeView]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isRegistering) {
      const res = await register(name, email, password, userId);
      if (res.success) {
        setSuccessMsg(res.message);
        setIsRegistering(false);
        setName('');
        setUserId('');
        setPassword('');
      } else {
        setError(res.message);
      }
    } else {
      const success = await login(email, password, role);
      if (!success) setError('Access Denied: Invalid credentials or unauthorized project node.');
      else setActiveView(role === UserRole.ADMIN ? 'dashboard' : 'portal');
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white flex flex-col lg:flex-row font-inter overflow-hidden">
        {/* Left Side: Dynamic Branding Section */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-950 p-16 flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-red-600/10 rounded-full blur-[120px] -mr-96 -mt-96"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[100px] -ml-48 -mb-48"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-16">
              <div className="w-14 h-14 bg-red-600 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-red-900/40 animate-pulse">
                <Globe className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-white font-jakarta">Exord</h1>
                <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.4em] -mt-1">Online Infrastructure</p>
              </div>
            </div>

            <div className="space-y-8 max-w-lg">
              <h2 className="text-5xl font-black text-white tracking-tighter leading-[1.1] font-jakarta">
                Unified Workforce <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-rose-400">Intelligence.</span>
              </h2>
              <p className="text-slate-400 text-lg font-medium leading-relaxed">
                Secure, enterprise-grade human resource management system with real-time biometric tracking and AI auditing.
              </p>
            </div>
          </div>

          <div className="relative z-10 border-t border-slate-900 pt-8 flex items-center justify-between">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">
                   <UserIcon size={16} className="text-slate-400" />
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-slate-950 bg-red-600 flex items-center justify-center text-[10px] font-bold text-white">
                +2.4k
              </div>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Global Protocol Active v4.2</p>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative bg-slate-50/50">
          <div className="w-full max-w-md space-y-10 animate-[fadeIn_0.6s_ease-out]">
            <div className="lg:hidden text-center mb-10">
               <Globe className="w-12 h-12 text-red-600 mx-auto mb-4" />
               <h2 className="text-3xl font-black text-slate-950 font-jakarta tracking-tight">Exord Online</h2>
            </div>

            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-900 font-jakarta tracking-tight">
                {isRegistering ? 'Provisional Registration' : 'Secure Authentication'}
              </h3>
              <p className="text-slate-500 font-medium">Please enter your node credentials to proceed.</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              {!isRegistering && (
                <div className="p-1 bg-slate-200/50 rounded-2xl flex gap-1">
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.EMPLOYEE)}
                    className={`flex-1 py-3 px-4 rounded-[0.9rem] text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                      role === UserRole.EMPLOYEE ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Staff Node
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole(UserRole.ADMIN)}
                    className={`flex-1 py-3 px-4 rounded-[0.9rem] text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                      role === UserRole.ADMIN ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Admin Node
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {isRegistering && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 group-focus-within:text-red-500 transition-colors" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name"
                        className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-red-50 focus:border-red-500/20 transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <div className="relative group">
                      <ShieldAlert className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 group-focus-within:text-red-500 transition-colors" />
                      <input
                        type="text"
                        required
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="Node ID"
                        className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-red-50 focus:border-red-500/20 transition-all placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                )}
                
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Internal Email Address"
                    className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-red-50 focus:border-red-500/20 transition-all placeholder:text-slate-300"
                  />
                </div>
                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Access Key"
                    className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-red-50 focus:border-red-500/20 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-600 text-[11px] font-black uppercase tracking-widest py-4 px-5 rounded-2xl border border-rose-100 flex items-center gap-3 animate-[shake_0.4s_ease-in-out]">
                  <ShieldAlert size={16} />
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-50 text-emerald-600 text-[11px] font-black uppercase tracking-widest py-4 px-5 rounded-2xl border border-emerald-100 flex items-center gap-3">
                  <CheckCircle2 size={16} />
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-5 bg-slate-950 hover:bg-red-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-slate-200 transition-all duration-300 active:scale-[0.98] group flex items-center justify-center gap-2"
              >
                {isRegistering ? 'Initialize Node' : 'Enter Network'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-red-600 transition-colors"
                >
                  {isRegistering ? 'Already have node access?' : 'Need a new project node?'}
                  <span className="block h-0.5 w-0 group-hover:w-full bg-red-600 transition-all mt-1"></span>
                </button>
              </div>
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
      case 'attendance': 
        return currentUser.role === UserRole.ADMIN ? <AdminDashboard /> : <EmployeePortal />;
      default: return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-6">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center animate-pulse">
            <Globe className="w-12 h-12 text-slate-200" />
          </div>
          <div className="space-y-2">
            <p className="text-slate-900 font-black uppercase tracking-widest text-xs">Section Encrypted</p>
            <p className="text-slate-400 font-medium italic text-sm">Waiting for administrator clearance...</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-40 md:hidden transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-500 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-72'}`}>
        <header className="sticky top-0 z-30 px-6 sm:px-10 py-6 bg-white/70 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-slate-100 text-slate-600 rounded-2xl md:hidden hover:bg-slate-200 transition-colors"
            >
              <Menu size={22} />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-slate-900 capitalize tracking-tight flex items-center gap-3 font-jakarta">
                {activeView.replace('-', ' ')}
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-8">
            <div className="hidden lg:flex items-center bg-slate-50 rounded-2xl px-5 py-2.5 text-slate-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-50 focus-within:border-red-500/20 border border-transparent transition-all">
              <Search size={16} className="mr-3" />
              <input type="text" placeholder="Global search..." className="bg-transparent border-none text-xs font-bold focus:ring-0 placeholder:text-slate-400 w-48 xl:w-80" />
            </div>
            
            <button className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all relative group">
              <Bell size={22} className="group-hover:rotate-12 transition-transform" />
              <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></span>
            </button>

            <div className="flex items-center gap-4 pl-8 border-l border-slate-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-slate-900 leading-none font-jakarta">{currentUser.name}</p>
                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mt-1.5">{currentUser.department}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-lg border-2 border-red-600/10 shadow-xl shadow-slate-200/50 hover:scale-105 transition-transform cursor-pointer">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 sm:p-10 max-w-[1600px] mx-auto w-full">
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
