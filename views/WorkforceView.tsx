
import React, { useState } from 'react';
import { useHRM } from '../store';
import { DEPARTMENTS } from '../constants';
import { User, UserRole } from '../types';
import { Users, Filter, Search, MoreVertical, Mail, Shield, DollarSign, Building2, ChevronRight, Download } from 'lucide-react';
import { formatCurrency } from '../utils';

const WorkforceView: React.FC = () => {
  const { users } = useHRM();
  const [selectedDept, setSelectedDept] = useState<string>('All Departments');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = users.filter(user => {
    const term = searchTerm.toLowerCase().trim();
    const matchesDept = selectedDept === 'All Departments' || user.department === selectedDept;
    
    if (user.role !== UserRole.EMPLOYEE || !matchesDept) return false;
    
    if (!term) return true;

    const matchesName = user.name.toLowerCase().includes(term);
    const matchesEmail = user.email.toLowerCase().includes(term);
    const matchesId = user.id.toLowerCase().includes(term);
    
    return matchesName || matchesEmail || matchesId;
  });

  return (
    <div className="space-y-10 animate-[fadeIn_0.6s_ease-out] pb-20">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter font-jakarta">Personnel Directory</h2>
          <p className="text-slate-500 text-lg font-medium">Centralized node management for internal workforce assets.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-red-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by name, node ID or internal mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-red-50 focus:border-red-500/20 transition-all w-full sm:w-96 shadow-sm"
            />
          </div>
          <button className="p-4 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all soft-shadow">
            <Download size={22} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 overflow-hidden soft-shadow">
        <div className="p-10 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-slate-50/20">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <h3 className="font-black text-slate-950 text-lg tracking-tight font-jakarta">Active Fleet Nodes</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Verified Internal Personnel</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 soft-shadow">
            <div className="flex items-center gap-2 px-4 text-slate-400">
              <Filter size={16} />
              <span className="text-[11px] font-black uppercase tracking-widest">Sector Filter:</span>
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-50 border-none rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-600 py-3 pl-4 pr-10 focus:ring-4 focus:ring-red-50/50 cursor-pointer transition-all"
            >
              <option>All Departments</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-slate-500 text-[11px] uppercase font-black tracking-[0.25em]">
              <tr>
                <th className="px-10 py-7">Infrastructure Entity</th>
                <th className="px-10 py-7">Department Cluster</th>
                <th className="px-10 py-7">Node Identity</th>
                <th className="px-10 py-7">Annual Allocation</th>
                <th className="px-10 py-7 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map((employee, i) => {
                const term = searchTerm.toLowerCase().trim();
                const isIdMatch = term && employee.id.toLowerCase().includes(term);
                
                return (
                  <tr key={employee.id} className="hover:bg-slate-50/30 transition-all duration-300 group animate-[fadeIn_0.5s_ease-out]" style={{ animationDelay: `${i * 50}ms` }}>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-xl group-hover:bg-red-600 transition-all duration-500 shadow-xl group-hover:scale-110 group-hover:rotate-3">
                          {employee.name.charAt(0)}
                        </div>
                        <div className="space-y-1">
                          <div className="text-base font-black text-slate-900 tracking-tight font-jakarta">{employee.name}</div>
                          <div className="text-xs text-slate-400 font-bold flex items-center gap-2">
                            <Mail size={12} className="text-slate-300" />
                            {employee.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-3">
                        <Building2 size={16} className="text-red-500 opacity-60" />
                        <span className="px-4 py-2 rounded-xl bg-slate-100/80 text-[10px] font-black text-slate-600 uppercase tracking-widest border border-slate-200/50 group-hover:bg-white transition-colors">{employee.department}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-500 ${isIdMatch ? 'bg-red-50 text-red-600 ring-2 ring-red-100 shadow-sm' : 'bg-slate-50/50 text-slate-500 border border-slate-100 group-hover:bg-white'}`}>
                        <Shield size={14} className={isIdMatch ? 'text-red-500' : 'text-slate-300'} />
                        <span className={`text-[13px] font-mono font-bold tracking-tight ${isIdMatch ? 'text-red-600' : 'text-slate-600'}`}>{employee.id}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-2 text-slate-950 font-black text-sm font-jakarta">
                        <DollarSign size={16} className="text-emerald-500" />
                        {formatCurrency(employee.baseSalary)}
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-1">/ annum</span>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <button className="p-3.5 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 rounded-2xl text-slate-400 hover:text-red-600 transition-all duration-300 active:scale-95 group/btn border border-transparent hover:border-slate-100">
                        <MoreVertical size={20} className="group-hover/btn:rotate-90 transition-transform duration-500" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 space-y-6">
                      <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center animate-pulse">
                        <Users size={40} className="text-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-black text-slate-900 font-jakarta">No Node Matches Detected</p>
                        <p className="text-sm font-medium italic max-w-xs mx-auto text-slate-400">Unable to locate personnel node with the specified authentication parameters.</p>
                      </div>
                      <button 
                        onClick={() => { setSelectedDept('All Departments'); setSearchTerm(''); }}
                        className="px-6 py-3 bg-red-50 text-red-600 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-xl shadow-red-100"
                      >
                        Reset Protocol Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-10 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.2em]">
            Protocol Report: <span className="text-slate-950">{filteredEmployees.length}</span> of <span className="text-slate-950">{users.filter(u => u.role === UserRole.EMPLOYEE).length}</span> nodes verified
          </p>
          <div className="flex gap-3">
            <button className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-all shadow-sm disabled:opacity-30" disabled>Archived Node Index</button>
            <button className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-all shadow-sm">Next Protocol Block</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkforceView;
