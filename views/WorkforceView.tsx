
import React, { useState } from 'react';
import { useHRM } from '../store';
import { DEPARTMENTS } from '../constants';
import { User, UserRole } from '../types';
import { Users, Filter, Search, Edit2, Mail, Shield, DollarSign, Building2, ChevronRight, Download, X, Save, UserCheck, ShieldAlert, UserPlus, FileUp, Hash, User as UserIcon, MapPin, CreditCard } from 'lucide-react';
import { formatCurrency } from '../utils';

const WorkforceView: React.FC = () => {
  const { users, updateUser, createEmployee, currentUser, departments } = useHRM();
  const [selectedDept, setSelectedDept] = useState<string>('All Departments');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Partial<User>>({
    name: '',
    id: '',
    email: '',
    department: departments[0]?.name || '',
    baseSalary: 45000,
    fatherName: '',
    motherName: '',
    nid: '',
    presentAddress: '',
    permanentAddress: '',
    documents: []
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canCreate = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR;

  const filteredEmployees = users.filter(user => {
    const term = searchTerm.toLowerCase().trim();
    const matchesDept = selectedDept === 'All Departments' || user.department === selectedDept;
    
    // Admins can see everyone
    if (!matchesDept) return false;
    
    if (!term) return true;

    const matchesName = user.name.toLowerCase().includes(term);
    const matchesEmail = user.email.toLowerCase().includes(term);
    const matchesId = user.id.toLowerCase().includes(term);
    
    return matchesName || matchesEmail || matchesId;
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateUser(editingUser.id, editingUser);
      setEditingUser(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const res = await createEmployee(newEmployee as any);
    if (res.success) {
      setSuccess(res.message);
      setTimeout(() => {
        setIsCreating(false);
        setSuccess('');
        setNewEmployee({
          name: '',
          id: '',
          email: '',
          department: departments[0]?.name || '',
          baseSalary: 45000,
          fatherName: '',
          motherName: '',
          nid: '',
          presentAddress: '',
          permanentAddress: '',
          documents: []
        });
      }, 1500);
    } else {
      setError(res.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files) as File[];
      // In a real app, we'd upload to a server. Here we'll just store names as placeholders
      const fileNames = fileArray.map(f => f.name);
      setNewEmployee(prev => ({ ...prev, documents: [...(prev.documents || []), ...fileNames] }));
    }
  };

  return (
    <div className="space-y-10 animate-[fadeIn_0.6s_ease-out] pb-20">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Personnel Directory</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Centralized node management for internal workforce assets.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {canCreate && (
            <button 
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-3 px-6 py-4 bg-[#E31E24] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl shadow-red-900/20"
            >
              <UserPlus size={18} />
              Onboard Asset
            </button>
          )}
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by name, ID or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 pr-6 py-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-red-500/10 focus:border-[#E31E24] transition-all w-full sm:w-96 shadow-sm"
            />
          </div>
          <button className="p-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all soft-shadow">
            <Download size={22} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-300 dark:border-slate-700 overflow-hidden soft-shadow transition-colors">
        <div className="p-10 border-b border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50/20 dark:bg-slate-800/20">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl border border-red-100 dark:border-red-900/40">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-950 dark:text-white text-lg tracking-tight font-jakarta">Fleet Inventory</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Verified Operational Nodes</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 px-4 text-slate-400">
              <Filter size={16} />
              <span className="text-[11px] font-black uppercase tracking-widest">Sector:</span>
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 dark:bg-slate-700 border-none rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 py-3 pl-4 pr-10 focus:ring-4 focus:ring-red-50/50 cursor-pointer transition-all"
            >
              <option>All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.name}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase font-black tracking-[0.25em] border-b border-slate-300 dark:border-slate-700">
              <tr>
                <th className="px-10 py-7">Infrastructure Entity</th>
                <th className="px-10 py-7">Operational Cluster</th>
                <th className="px-10 py-7">Node ID</th>
                <th className="px-10 py-7">Annual Yield</th>
                <th className="px-10 py-7 text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredEmployees.map((employee, i) => (
                <tr key={employee.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all duration-300 group">
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center font-black text-xl transition-all duration-500 shadow-xl group-hover:scale-110 group-hover:rotate-3 border border-white/10 ${
                        employee.role === UserRole.ADMIN ? 'bg-slate-900 dark:bg-red-700' : 'bg-red-600'
                      }`}>
                        {employee.name.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <div className="text-base font-black text-slate-900 dark:text-white tracking-tight font-jakarta flex items-center gap-2">
                          {employee.name}
                          {employee.role === UserRole.ADMIN && <Shield size={12} className="text-[#E31E24]" />}
                        </div>
                        <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
                          <Mail size={12} className="opacity-60" />
                          {employee.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-3">
                      <Building2 size={16} className="text-[#E31E24] opacity-60" />
                      <span className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-300 dark:border-slate-700">{employee.department}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 group-hover:border-red-600/30 transition-colors">
                      <span className="text-[13px] font-mono font-bold tracking-tight text-slate-600 dark:text-slate-400">{employee.id}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex items-center gap-2 text-slate-950 dark:text-white font-black text-sm font-jakarta">
                      <DollarSign size={16} className="text-emerald-500" />
                      {formatCurrency(employee.baseSalary)}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <button 
                      onClick={() => setEditingUser({...employee})}
                      className="p-3.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 hover:border-[#E31E24] hover:text-[#E31E24] rounded-2xl text-slate-400 transition-all duration-300 active:scale-95 shadow-sm"
                    >
                      <Edit2 size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl border-2 border-slate-300 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#E31E24] text-white rounded-2xl shadow-lg">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">Provision New Workforce Node</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Default Password: <span className="text-[#E31E24]">Exord@123</span> (Force change on first login)</p>
                </div>
              </div>
              <button onClick={() => setIsCreating(false)} className="p-3 text-slate-400 hover:text-red-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
              {error && <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[11px] font-black uppercase tracking-widest rounded-2xl border-2 border-rose-100 dark:border-rose-900/40 flex items-center gap-3 animate-pulse"><ShieldAlert size={14} /> {error}</div>}
              {success && <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-widest rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3"><UserCheck size={14} /> {success}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-2">Primary Identification</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Employee Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="text" required value={newEmployee.name} onChange={e => setNewEmployee({...newEmployee, name: e.target.value})} placeholder="Full Legal Name" className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Employee ID</label>
                        <div className="relative">
                          <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input type="text" required value={newEmployee.id} onChange={e => setNewEmployee({...newEmployee, id: e.target.value})} placeholder="E1001" className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">NID Number</label>
                        <div className="relative">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input type="text" required value={newEmployee.nid} onChange={e => setNewEmployee({...newEmployee, nid: e.target.value})} placeholder="National ID" className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="email" required value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} placeholder="internal@exordonline.com" className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Family Info */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-2">Family Lineage</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Father's Name</label>
                      <input type="text" required value={newEmployee.fatherName} onChange={e => setNewEmployee({...newEmployee, fatherName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Mother's Name</label>
                      <input type="text" required value={newEmployee.motherName} onChange={e => setNewEmployee({...newEmployee, motherName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                    </div>
                  </div>
                </div>

                {/* Address Info */}
                <div className="space-y-6 md:col-span-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-2">Geospatial Residency</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Present Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-4 text-slate-400 w-4 h-4" />
                        <textarea required value={newEmployee.presentAddress} onChange={e => setNewEmployee({...newEmployee, presentAddress: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all min-h-[100px]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Permanent Address</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-4 text-slate-400 w-4 h-4" />
                        <textarea required value={newEmployee.permanentAddress} onChange={e => setNewEmployee({...newEmployee, permanentAddress: e.target.value})} className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all min-h-[100px]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="space-y-6 md:col-span-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-2">Verification Documents</h4>
                  <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-[2.5rem] bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center text-center group hover:border-[#E31E24] transition-all">
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      <FileUp className="text-[#E31E24] w-8 h-8" />
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Upload Identity Proofs</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">PDF, JPG or PNG (Max 10MB)</p>
                    <input type="file" multiple onChange={handleFileUpload} className="hidden" id="doc-upload" />
                    <label htmlFor="doc-upload" className="mt-6 px-8 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-[#E31E24] transition-all">Select Files</label>
                    
                    {newEmployee.documents && newEmployee.documents.length > 0 && (
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {newEmployee.documents.map((doc, i) => (
                          <div key={i} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-emerald-100 dark:border-emerald-900/40 flex items-center gap-2">
                            <Save size={10} /> {doc}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel Onboarding</button>
                <button type="submit" className="flex-[2] py-5 bg-slate-950 dark:bg-[#E31E24] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-900/20 transition-all flex items-center justify-center gap-3 group">
                  <UserCheck size={16} className="group-hover:scale-110 transition-transform" />
                  Finalize Provisioning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl border-2 border-slate-300 dark:border-slate-800 overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#E31E24] text-white rounded-2xl shadow-lg">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">Override Asset Data</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Operational ID: {editingUser.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-3 text-slate-400 hover:text-red-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-10 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Asset Full Name</label>
                  <input
                    type="text" required value={editingUser.name}
                    onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Access Tier (Role)</label>
                  <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex gap-1 border border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={() => setEditingUser({...editingUser, role: UserRole.EMPLOYEE})} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingUser.role === UserRole.EMPLOYEE ? 'bg-white dark:bg-slate-700 text-[#E31E24] shadow-sm' : 'text-slate-500'}`}>Staff</button>
                    <button type="button" onClick={() => setEditingUser({...editingUser, role: UserRole.ADMIN})} className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingUser.role === UserRole.ADMIN ? 'bg-white dark:bg-slate-700 text-[#E31E24] shadow-sm' : 'text-slate-500'}`}>Admin</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Operational Cluster</label>
                  <select
                    value={editingUser.department}
                    onChange={(e) => setEditingUser({...editingUser, department: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all appearance-none cursor-pointer"
                  >
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Yield Allocation (Annual)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-500" />
                    <input
                      type="number" required value={editingUser.baseSalary}
                      onChange={(e) => setEditingUser({...editingUser, baseSalary: parseInt(e.target.value) || 0})}
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button" onClick={() => setEditingUser(null)}
                  className="flex-1 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Discard Overrides
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-5 bg-slate-950 dark:bg-[#E31E24] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-900/20 transition-all flex items-center justify-center gap-3 group"
                >
                  <Save size={16} className="group-hover:scale-110 transition-transform" />
                  Commit Changes to Core
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceView;
