
import React, { useState } from 'react';
import { useHRM } from '../store';
import { Building2, MapPin, Plus, Save, X, Edit2, Trash2, Globe, Shield, Hash } from 'lucide-react';
import { Unit, Department } from '../types';

const InfrastructureView: React.FC = () => {
  const { units, departments, addUnit, updateUnit, addDepartment, updateDepartment } = useHRM();
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const [newUnit, setNewUnit] = useState<Omit<Unit, 'id'>>({
    name: '',
    lat: 23.8103,
    lng: 90.4125,
    radius: 50
  });

  const [newDept, setNewDept] = useState<Omit<Department, 'id'>>({
    name: '',
    unitId: units[0]?.id || ''
  });

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    addUnit(newUnit);
    setIsAddingUnit(false);
    setNewUnit({ name: '', lat: 23.8103, lng: 90.4125, radius: 50 });
  };

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    addDepartment(newDept);
    setIsAddingDept(false);
    setNewDept({ name: '', unitId: units[0]?.id || '' });
  };

  return (
    <div className="space-y-10 animate-[fadeIn_0.6s_ease-out] pb-20">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Infrastructure Control</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Manage physical units and organizational departments.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsAddingUnit(true)}
            className="flex items-center gap-3 px-6 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#E31E24] transition-all shadow-xl"
          >
            <Building2 size={18} />
            New Unit
          </button>
          <button 
            onClick={() => setIsAddingDept(true)}
            className="flex items-center gap-3 px-6 py-4 bg-[#E31E24] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-xl shadow-red-900/20"
          >
            <Plus size={18} />
            New Dept
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Units Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Globe className="text-[#E31E24]" size={24} />
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Active Units</h3>
          </div>
          <div className="grid gap-4">
            {units.map(unit => (
              <div key={unit.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 shadow-sm hover:border-[#E31E24] transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 group-hover:bg-[#E31E24] group-hover:text-white transition-all">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white">{unit.name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">ID: {unit.id}</p>
                    </div>
                  </div>
                  <button className="p-2 text-slate-400 hover:text-[#E31E24] transition-colors">
                    <Edit2 size={18} />
                  </button>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Coordinates</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <MapPin size={12} className="text-[#E31E24]" />
                      {unit.lat.toFixed(4)}, {unit.lng.toFixed(4)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Geofence Radius</p>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Shield size={12} className="text-[#E31E24]" />
                      {unit.radius} Meters
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Departments Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Shield className="text-[#E31E24]" size={24} />
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Organizational Units</h3>
          </div>
          <div className="grid gap-4">
            {departments.map(dept => {
              const unit = units.find(u => u.id === dept.unitId);
              return (
                <div key={dept.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 shadow-sm hover:border-[#E31E24] transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 group-hover:bg-[#E31E24] group-hover:text-white transition-all">
                        <Hash size={24} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white">{dept.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Building2 size={10} className="text-[#E31E24]" />
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{unit?.name || 'Unassigned'}</p>
                        </div>
                      </div>
                    </div>
                    <button className="p-2 text-slate-400 hover:text-[#E31E24] transition-colors">
                      <Edit2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Unit Modal */}
      {isAddingUnit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl border-2 border-slate-300 dark:border-slate-800 overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#E31E24] text-white rounded-2xl shadow-lg">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">Provision New Unit</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Define physical node coordinates</p>
                </div>
              </div>
              <button onClick={() => setIsAddingUnit(false)} className="p-3 text-slate-400 hover:text-red-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddUnit} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Unit Name</label>
                <input type="text" required value={newUnit.name} onChange={e => setNewUnit({...newUnit, name: e.target.value})} placeholder="e.g. Dhaka HQ" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Latitude</label>
                  <input type="number" step="any" required value={newUnit.lat} onChange={e => setNewUnit({...newUnit, lat: parseFloat(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Longitude</label>
                  <input type="number" step="any" required value={newUnit.lng} onChange={e => setNewUnit({...newUnit, lng: parseFloat(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Geofence Radius (Meters)</label>
                <input type="number" required value={newUnit.radius} onChange={e => setNewUnit({...newUnit, radius: parseInt(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
              </div>
              <button type="submit" className="w-full py-5 bg-slate-950 dark:bg-[#E31E24] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-900/20 transition-all flex items-center justify-center gap-3">
                <Save size={16} />
                Finalize Node
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Dept Modal */}
      {isAddingDept && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.3s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl border-2 border-slate-300 dark:border-slate-800 overflow-hidden">
            <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#E31E24] text-white rounded-2xl shadow-lg">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white font-jakarta tracking-tight">Create Organizational Unit</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Link department to physical unit</p>
                </div>
              </div>
              <button onClick={() => setIsAddingDept(false)} className="p-3 text-slate-400 hover:text-red-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddDept} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Department Name</label>
                <input type="text" required value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} placeholder="e.g. Field Engineering" className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Assign to Unit</label>
                <select required value={newDept.unitId} onChange={e => setNewDept({...newDept, unitId: e.target.value})} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all appearance-none">
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-950 dark:bg-[#E31E24] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-900/20 transition-all flex items-center justify-center gap-3">
                <Save size={16} />
                Initialize Unit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfrastructureView;
