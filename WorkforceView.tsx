import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useHRM } from '../store';
import { User, UserRole, WeekDay, ALL_WEEK_DAYS } from '../types';
import {
  Users, Filter, Search, Edit2, Mail, Shield, DollarSign,
  Building2, X, Save, UserCheck, ShieldAlert,
  UserPlus, Hash, User as UserIcon, MapPin, CreditCard,
  Plus, Trash2, AlertTriangle, Layers, Camera, MessageSquare, Eye,
  Paperclip, FileText, Image as ImageIcon, Upload, Loader2, CheckCircle2,
  CalendarClock, ClipboardCheck, Clock
} from 'lucide-react';
import { formatCurrency } from '../utils';
import { uploadDocument } from '../fileService';

// Weekend day selector component
const WeekendSelector: React.FC<{
  value: WeekDay[];
  onChange: (days: WeekDay[]) => void;
}> = ({ value, onChange }) => {
  const toggle = (day: WeekDay) => {
    if (value.includes(day)) {
      onChange(value.filter(d => d !== day));
    } else {
      onChange([...value, day]);
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_WEEK_DAYS.map(day => (
        <button
          key={day}
          type="button"
          onClick={() => toggle(day)}
          className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
            value.includes(day)
              ? 'bg-[#E31E24] text-white border-[#E31E24]'
              : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
          }`}
        >
          {day.slice(0, 3)}
        </button>
      ))}
    </div>
  );
};

interface Props { onNavigate?: (view: string) => void; }

const WorkforceView: React.FC<Props> = ({ onNavigate }) => {
  const {
    users, updateUser, createEmployee, deleteEmployee,
    uploadAvatar, currentUser, departments, units,
    addDepartment, deleteDepartment,
    profileChangeRequests, reviewProfileChangeRequest,
    setDocDeadline, setDocDeadlineBulk, hasPermission,
  } = useHRM();

  const [selectedDept, setSelectedDept] = useState<string>('All Departments');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showClusterManager, setShowClusterManager] = useState(false);
  const [showPCRPanel, setShowPCRPanel] = useState(false);
  const [rejectingPCRId, setRejectingPCRId] = useState<string | null>(null);
  const [pcrRejectNote, setPCRRejectNote] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptUnitId, setNewDeptUnitId] = useState('');
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);
  const [clusterSaving, setClusterSaving] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [newEmployee, setNewEmployee] = useState<Partial<User> & {
    weekendDays: WeekDay[]; checkInTime: string; checkOutTime: string; joinDate: string;
    gender: string; bloodGroup: string; dressSize: string; dateOfBirth: string;
    phoneOfficial: string; phonePersonal: string; phoneAlternative: string;
    religion: string; maritalStatus: string; nationality: string;
    emergencyName: string; emergencyAddress: string; emergencyContact: string; emergencyRelation: string;
    unitId: string;
  }>({
    name: '', id: '', email: '',
    department: departments[0]?.name || '',
    unitId: departments[0]?.unitIds?.[0] || departments[0]?.unitId || '',
    baseSalary: 45000,
    role: 'EMPLOYEE' as any,
    fatherName: '', motherName: '', nid: '',
    presentAddress: '', permanentAddress: '',
    weekendDays: ['Friday', 'Saturday'],
    checkInTime: '09:00',
    checkOutTime: '18:00',
    joinDate: new Date().toISOString().split('T')[0],
    gender: '', bloodGroup: '', dressSize: '', dateOfBirth: '',
    phoneOfficial: '', phonePersonal: '', phoneAlternative: '',
    religion: '', maritalStatus: '', nationality: 'Bangladeshi',
    emergencyName: '', emergencyAddress: '', emergencyContact: '', emergencyRelation: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // ── Document upload state for create form ────────────────────────────────
  const [nidPhotoUploading, setNidPhotoUploading] = useState(false);
  const [nidPhotoUrl, setNidPhotoUrl] = useState<string | null>(null);
  const [nidPhotoName, setNidPhotoName] = useState<string>('');
  const [extraDocs, setExtraDocs] = useState<{ url: string; name: string; label: string }[]>([]);
  const [extraDocUploading, setExtraDocUploading] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');
  const [pendingDocLabel, setPendingDocLabel] = useState('');
  const [showDocLabelInput, setShowDocLabelInput] = useState(false);
  const [pendingDocFile, setPendingDocFile] = useState<File | null>(null);
  const nidPhotoRef = useRef<HTMLInputElement>(null);
  const extraDocRef = useRef<HTMLInputElement>(null);

  // ── Custom roles (fetched from Supabase so new roles appear immediately) ──
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string>('');
  const [customRolesLoading, setCustomRolesLoading] = useState(false);

  // ── Document deadline management state ───────────────────────────────────
  const [newEmployeeDocDeadline, setNewEmployeeDocDeadline] = useState<string>('');
  const [deadlinePickerUserId, setDeadlinePickerUserId] = useState<string | null>(null);
  const [deadlinePickerValue, setDeadlinePickerValue] = useState<string>('');
  const [deadlineSaving, setDeadlineSaving] = useState(false);
  const [deadlineMsg, setDeadlineMsg] = useState<string>('');
  const [showBulkDeadline, setShowBulkDeadline] = useState(false);
  const [bulkDeadlineValue, setBulkDeadlineValue] = useState<string>('');
  const [bulkDeadlineSaving, setBulkDeadlineSaving] = useState(false);
  const [bulkDeadlineMsg, setBulkDeadlineMsg] = useState<string>('');

  const fetchCustomRoles = useCallback(async () => {
    setCustomRolesLoading(true);
    const { data, error } = await supabase
      .from('custom_roles')
      .select('id, name, color')
      .order('name', { ascending: true });
    setCustomRolesLoading(false);
    if (error) {
      console.error('[WorkforceView] custom_roles fetch failed:', error.message, error.code);
      return;
    }
    console.log('[WorkforceView] custom_roles loaded:', data?.length, data);
    if (data) setCustomRoles(data);
  }, []);

  useEffect(() => { fetchCustomRoles(); }, [fetchCustomRoles]);

  // Also refetch every time the create modal opens so it's always fresh
  useEffect(() => {
    if (isCreating) fetchCustomRoles();
  }, [isCreating, fetchCustomRoles]);

  const canCreate = currentUser?.role === UserRole.DEVELOPER || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR;
  const isAdmin = currentUser?.role === UserRole.DEVELOPER || currentUser?.role === UserRole.ADMIN;
  // ONLY Admin, Co-Admin, HR can see salary and personal details
  const canSeeSensitive = [UserRole.DEVELOPER, UserRole.ADMIN, UserRole.CO_ADMIN, UserRole.HR].includes(currentUser?.role as UserRole);
  const canEdit = canSeeSensitive;
  const canManageDeadline = currentUser ? (
    [UserRole.DEVELOPER, UserRole.ADMIN].includes(currentUser.role) ||
    hasPermission(currentUser.id, 'doc_deadline')
  ) : false;

  const handleMessageClick = (employeeId: string) => {
    try { localStorage.setItem('exord-dm-target', employeeId); } catch {}
    onNavigate?.('chat');
  };

  const filteredEmployees = users.filter(user => {
    const term = searchTerm.toLowerCase().trim();
    const matchesDept = selectedDept === 'All Departments' || user.department === selectedDept;
    if (!matchesDept) return false;
    if (!term) return true;
    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.id.toLowerCase().includes(term)
    );
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await updateUser(editingUser.id, editingUser);
      setEditingUser(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    const payload = {
      ...(newEmployee as any),
      documents: [
        ...(nidPhotoUrl ? [{ url: nidPhotoUrl, name: nidPhotoName || 'NID Document', label: 'NID / Identity Document' }] : []),
        ...extraDocs.map(d => ({ url: d.url, name: d.name, label: d.label })),
      ],
      docDeadline: newEmployeeDocDeadline ? new Date(newEmployeeDocDeadline + 'T23:59:59').toISOString() : null,
      checkInTime: newEmployee.checkInTime || '09:00',
      checkOutTime: newEmployee.checkOutTime || '18:00',
      joinDate: newEmployee.joinDate || new Date().toISOString().split('T')[0],
    };
    const res = await createEmployee(payload);
    if (res.success) {
      // If a custom role was selected, add the new employee to that role's members
      if (selectedCustomRoleId && newEmployee.id) {
        const { error: memberError } = await supabase.from('custom_role_members').insert({
          role_id: selectedCustomRoleId,
          user_id: newEmployee.id.toUpperCase(),   // createEmployee uppercases the ID
        });
        if (memberError) console.error('[WorkforceView] custom_role_members insert failed:', memberError.message);
      }
      setSuccess(res.message);
      setTimeout(() => {
        setIsCreating(false); setSuccess('');
        setSelectedCustomRoleId('');
        setNewEmployee({ name: '', id: '', email: '', department: departments[0]?.name || '', unitId: departments[0]?.unitIds?.[0] || departments[0]?.unitId || '', baseSalary: 45000, role: 'EMPLOYEE' as any, fatherName: '', motherName: '', nid: '', presentAddress: '', permanentAddress: '', weekendDays: ['Friday', 'Saturday'], checkInTime: '09:00', checkOutTime: '18:00', joinDate: new Date().toISOString().split('T')[0], gender: '', bloodGroup: '', dressSize: '', dateOfBirth: '', phoneOfficial: '', phonePersonal: '', phoneAlternative: '', religion: '', maritalStatus: '', nationality: 'Bangladeshi', emergencyName: '', emergencyAddress: '', emergencyContact: '', emergencyRelation: '' });
        setNidPhotoUrl(null); setNidPhotoName('');
        setExtraDocs([]); setDocUploadError('');
        setShowDocLabelInput(false); setPendingDocLabel(''); setPendingDocFile(null);
        setNewEmployeeDocDeadline('');
      }, 1500);
    } else { setError(res.message); }
  };

  // ── NID photo upload ──────────────────────────────────────────────────────
  const handleNidPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploadError('');
    // Use temp ID for upload path since real ID may not be set yet
    const tempId = (newEmployee.id || 'TEMP').toUpperCase();
    setNidPhotoUploading(true);
    try {
      const result = await uploadDocument(file, tempId);
      setNidPhotoUrl(result.url);
      setNidPhotoName(file.name);
    } catch (err: any) {
      setDocUploadError(err.message || 'NID photo upload failed.');
    } finally {
      setNidPhotoUploading(false);
      if (nidPhotoRef.current) nidPhotoRef.current.value = '';
    }
  };

  // ── Extra document: select file → show label input → confirm upload ──────
  const handleExtraDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingDocFile(file);
    setPendingDocLabel('');
    setShowDocLabelInput(true);
    setDocUploadError('');
    if (extraDocRef.current) extraDocRef.current.value = '';
  };

  const handleExtraDocUpload = async () => {
    if (!pendingDocFile || !pendingDocLabel.trim()) {
      setDocUploadError('Please enter a document label first.');
      return;
    }
    const tempId = (newEmployee.id || 'TEMP').toUpperCase();
    setExtraDocUploading(true);
    setDocUploadError('');
    try {
      const result = await uploadDocument(pendingDocFile, tempId);
      setExtraDocs(prev => [...prev, { url: result.url, name: pendingDocFile.name, label: pendingDocLabel.trim() }]);
      setPendingDocFile(null); setPendingDocLabel(''); setShowDocLabelInput(false);
    } catch (err: any) {
      setDocUploadError(err.message || 'Document upload failed.');
    } finally {
      setExtraDocUploading(false);
    }
  };

  // ── Deadline handlers ─────────────────────────────────────────────────────
  const handleSetDeadline = async (userId: string, deadline: string) => {
    setDeadlineSaving(true);
    setDeadlineMsg('');
    const iso = deadline ? new Date(deadline + 'T23:59:59').toISOString() : null;
    const res = await setDocDeadline(userId, iso);
    setDeadlineMsg(res.message);
    setDeadlineSaving(false);
    if (res.success) setTimeout(() => { setDeadlinePickerUserId(null); setDeadlineMsg(''); }, 1800);
  };

  const handleBulkDeadline = async () => {
    setBulkDeadlineSaving(true);
    setBulkDeadlineMsg('');
    // Apply to all employees without documents
    const targets = users.filter(u =>
      [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.HR, UserRole.CO_ADMIN].includes(u.role) &&
      (!u.documents || (u.documents as any[]).length === 0)
    ).map(u => u.id);
    if (!targets.length) { setBulkDeadlineMsg('No employees without documents found.'); setBulkDeadlineSaving(false); return; }
    const iso = bulkDeadlineValue ? new Date(bulkDeadlineValue + 'T23:59:59').toISOString() : null;
    const res = await setDocDeadlineBulk(targets, iso);
    setBulkDeadlineMsg(res.message);
    setBulkDeadlineSaving(false);
    if (res.success) setTimeout(() => { setShowBulkDeadline(false); setBulkDeadlineMsg(''); setBulkDeadlineValue(''); }, 2000);
  };

  const handleDelete = async () => {
    if (!deletingUserId) return;
    setDeleteError('');
    const res = await deleteEmployee(deletingUserId);
    if (res.success) { setDeletingUserId(null); }
    else { setDeleteError(res.message); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, userId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Image must be under 2MB.'); return; }
    setAvatarUploading(true);
    const res = await uploadAvatar(userId, file);
    setAvatarUploading(false);
    if (res.success && res.url) {
      // Update editingUser state so the preview refreshes immediately
      setEditingUser(prev => prev ? { ...prev, avatar: res.url } : prev);
    } else {
      setAvatarError(res.message);
    }
    // Reset input
    e.target.value = '';
  };

  const handleAddCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setClusterSaving(true);
    const unitId = newDeptUnitId || units[0]?.id || '';
    await addDepartment({ name: newDeptName.trim(), unitId });
    setNewDeptName(''); setNewDeptUnitId(''); setClusterSaving(false);
  };

  const handleDeleteCluster = async () => {
    if (!deletingDeptId) return;
    await deleteDepartment(deletingDeptId);
    setDeletingDeptId(null);
  };

  const inputCls = "w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] focus:outline-none transition-all";
  const userToDelete = users.find(u => u.id === deletingUserId);

  return (
    <div className="space-y-6 animate-[fadeIn_0.6s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Personnel Directory</h2>
          <p className="text-slate-500 dark:text-slate-400 text-base font-medium">Manage and track your workforce.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canSeeSensitive && (() => {
            const pendingPCR = profileChangeRequests.filter((r: any) => r.status === 'PENDING').length;
            return (
              <button onClick={() => setShowPCRPanel(true)}
                className="relative flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:border-[#E31E24] hover:text-[#E31E24] transition-all rounded-2xl">
                <Edit2 size={14} /> Profile Requests
                {pendingPCR > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#E31E24] text-white text-[9px] font-black rounded-full flex items-center justify-center">{pendingPCR}</span>
                )}
              </button>
            );
          })()}
          {isAdmin && (
            <button onClick={() => setShowClusterManager(true)}
              className="flex items-center gap-2 px-5 py-3 bg-slate-900 dark:bg-slate-700 text-white font-black uppercase tracking-widest text-xs hover:bg-[#E31E24] transition-all">
              <Layers size={16} /> Manage Depts
            </button>
          )}
          {canManageDeadline && (
            <button onClick={() => setShowBulkDeadline(true)}
              className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white font-black uppercase tracking-widest text-xs hover:bg-amber-600 transition-all shadow-lg shadow-amber-900/20">
              <CalendarClock size={16} /> Doc Deadline
            </button>
          )}
          {canCreate && (
            <button onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-900/20">
              <UserPlus size={16} /> Add Employee
            </button>
          )}
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="Search by name, ID or email..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#E31E24] transition-all w-full sm:w-80" />
          </div>
        </div>
      </div>

      {/* Table */}
      {/* Mobile employee cards */}
      <div className="md:hidden space-y-3">
        {filteredEmployees.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm italic bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">No employees found.</div>
        )}
        {filteredEmployees.map(employee => (
          <div key={employee.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 flex-shrink-0 rounded-xl overflow-hidden bg-[#E31E24] flex items-center justify-center">
                {employee.avatar
                  ? <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover"/>
                  : <span className="text-white font-black text-base">{employee.name.charAt(0)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                  {employee.name}
                  {employee.role === UserRole.ADMIN && <Shield size={11} className="text-[#E31E24] flex-shrink-0"/>}
                </p>
                <p className="text-[10px] text-slate-400 font-medium truncate">{employee.email}</p>
              </div>
              <span className={`flex-shrink-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border rounded-lg ${
                employee.role === UserRole.DEVELOPER ? 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/10' :
                employee.role === UserRole.ADMIN    ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10' :
                employee.role === UserRole.HR       ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/10' :
                employee.role === UserRole.MANAGER  ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/10' :
                'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
              }`}>
                {employee.role === UserRole.CO_ADMIN ? 'Co-Admin' : employee.role}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest rounded-lg border border-slate-200 dark:border-slate-700">{employee.department}</span>
              <span className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/50 text-[9px] font-mono font-bold text-slate-400 rounded-lg border border-slate-100 dark:border-slate-700">{employee.id}</span>
              {canSeeSensitive && <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/10 text-[9px] font-black text-emerald-600 rounded-lg border border-emerald-100 dark:border-emerald-900/30">{formatCurrency(employee.baseSalary)}</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {employee.id !== currentUser?.id && (
                <button onClick={() => handleMessageClick(employee.id)} className="flex-1 py-2 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all">
                  <MessageSquare size={12}/> Message
                </button>
              )}
              <button onClick={() => setViewingUser(employee)} className="flex-1 py-2 text-[10px] font-black uppercase text-blue-500 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all">
                <Eye size={12}/> View
              </button>
              {canEdit && (
                <button onClick={() => { setEditingUser({ ...employee }); setAvatarError(''); }} className="flex-1 py-2 text-[10px] font-black uppercase text-[#E31E24] bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all">
                  <Edit2 size={12}/> Edit
                </button>
              )}
              {isAdmin && employee.id !== currentUser?.id && (
                <button onClick={() => { setDeletingUserId(employee.id); setDeleteError(''); }} className="p-2 text-slate-300 hover:text-rose-500 border border-slate-200 dark:border-slate-700 rounded-xl transition-all">
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-100 dark:border-red-900/40"><Users size={20}/></div>
            <div><h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-widest">Employees</h3><p className="text-[10px] text-slate-400 font-bold mt-0.5">{filteredEmployees.length} records</p></div>
          </div>
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700">
            <Filter size={14} className="text-slate-400"/>
            <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 py-1 pr-6 focus:outline-none cursor-pointer">
              <option>All Departments</option>
              {departments.map(dept => <option key={dept.id} value={dept.name}>{dept.name}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-4 whitespace-nowrap">Employee</th>
                <th className="px-4 py-4 whitespace-nowrap">Department</th>
                <th className="px-4 py-4 whitespace-nowrap">Role</th>
                <th className="px-4 py-4 whitespace-nowrap">ID</th>
                {canSeeSensitive && <th className="px-4 py-4 whitespace-nowrap">Salary</th>}
                <th className="px-4 py-4 whitespace-nowrap">Weekend</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee, i) => (
                <tr key={employee.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors border-b border-slate-100 dark:border-slate-800/60 ${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/40 dark:bg-slate-800/10'}`}>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex-shrink-0 overflow-hidden bg-[#E31E24] flex items-center justify-center">
                        {employee.avatar ? <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover"/> : <span className="text-white font-black text-base">{employee.name.charAt(0)}</span>}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">{employee.name}{employee.role === UserRole.ADMIN && <Shield size={11} className="text-[#E31E24]"/>}</div>
                        <div className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-0.5"><Mail size={10} className="opacity-60"/>{employee.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest border border-slate-200 dark:border-slate-700">{employee.department}</span>
                    {(() => { const dept = departments.find(d => d.name === employee.department); const ids = dept?.unitIds?.length ? dept.unitIds : (dept?.unitId ? [dept.unitId] : []); const names = ids.map(id => units.find(u => u.id === id)?.name).filter(Boolean); return names.length ? <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{names.join(' · ')}</p> : null; })()}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                      employee.role === UserRole.DEVELOPER ? 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/10 dark:border-violet-900/30' :
                      employee.role === UserRole.ADMIN    ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' :
                      employee.role === UserRole.CO_ADMIN ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/30' :
                      employee.role === UserRole.HR       ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' :
                      employee.role === UserRole.MANAGER  ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/30' :
                      'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                    }`}>{employee.role === UserRole.DEVELOPER ? 'Developer' : employee.role === UserRole.CO_ADMIN ? 'Co-Admin' : employee.role}</span>
                  </td>
                  <td className="px-4 py-4"><span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">{employee.id}</span></td>
                  {canSeeSensitive && (
                    <td className="px-4 py-4"><div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-black text-sm"><DollarSign size={14} className="text-emerald-500"/>{formatCurrency(employee.baseSalary)}</div></td>
                  )}
                  <td className="px-4 py-4"><span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{(employee.weekendDays || ['Fri', 'Sat']).map(d => d.slice(0, 3)).join(' & ')}</span></td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {employee.id !== currentUser?.id && <button onClick={() => handleMessageClick(employee.id)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-500 text-slate-400 transition-all" title="Message"><MessageSquare size={15}/></button>}
                      <button onClick={() => setViewingUser(employee)} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-500 text-slate-400 transition-all" title="View"><Eye size={15}/></button>
                      {canEdit && <button onClick={() => { setEditingUser({ ...employee }); setAvatarError(''); }} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#E31E24] hover:text-[#E31E24] text-slate-400 transition-all" title="Edit"><Edit2 size={15}/></button>}
                      {isAdmin && employee.id !== currentUser?.id && <button onClick={() => { setDeletingUserId(employee.id); setDeleteError(''); }} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-500 hover:text-rose-500 text-slate-400 transition-all" title="Delete"><Trash2 size={15}/></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr><td colSpan={7} className="py-20 text-center text-slate-400 text-sm italic">No employees found.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* ── Bulk Document Deadline Modal ── */}
      {showBulkDeadline && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-3">
              <CalendarClock size={20} className="text-amber-500" />
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">Bulk Document Deadline</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Apply a deadline to all employees without documents</p>
              </div>
              <button onClick={() => { setShowBulkDeadline(false); setBulkDeadlineMsg(''); setBulkDeadlineValue(''); }} className="ml-auto p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Deadline Date</label>
                <input
                  type="date"
                  value={bulkDeadlineValue}
                  onChange={e => setBulkDeadlineValue(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:border-amber-400 transition-all"
                />
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                Applies to: <strong>{users.filter(u => [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.HR, UserRole.CO_ADMIN].includes(u.role) && (!u.documents || (u.documents as any[]).length === 0)).length}</strong> employees without documents
              </div>
              {bulkDeadlineMsg && (
                <p className={`text-xs font-bold px-3 py-2 ${bulkDeadlineMsg.includes('No') ? 'text-slate-500' : 'text-emerald-600'}`}>{bulkDeadlineMsg}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowBulkDeadline(false); setBulkDeadlineMsg(''); setBulkDeadlineValue(''); }}
                  className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-500 font-black text-xs uppercase tracking-widest hover:border-slate-400 transition-all">
                  Cancel
                </button>
                <button onClick={handleBulkDeadline} disabled={!bulkDeadlineValue || bulkDeadlineSaving}
                  className="flex-[2] py-3 bg-amber-500 text-white font-black text-xs uppercase tracking-widest hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {bulkDeadlineSaving ? <><Loader2 size={13} className="animate-spin" /> Applying...</> : <><ClipboardCheck size={13} /> Set Deadline</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deletingUserId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-rose-50 dark:bg-rose-900/10 flex items-center gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600"><AlertTriangle size={20} /></div>
              <h3 className="text-lg font-black text-rose-700 dark:text-rose-400">Delete Employee</h3>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-slate-700 dark:text-slate-300 font-bold text-sm">
                Permanently delete <span className="text-[#E31E24] font-black">{userToDelete?.name}</span> ({userToDelete?.id})?
              </p>
              <p className="text-slate-400 text-xs font-medium">This action cannot be undone.</p>
              {deleteError && <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-xs font-black uppercase tracking-widest border border-rose-200">{deleteError}</div>}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setDeletingUserId(null); setDeleteError(''); }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                  Cancel
                </button>
                <button onClick={handleDelete}
                  className="flex-[2] py-3 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2">
                  <Trash2 size={14} /> Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Department Manager Modal ── */}
      {showClusterManager && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#E31E24] text-white"><Layers size={18} /></div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Manage Departments</h3>
              </div>
              <button onClick={() => setShowClusterManager(false)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <form onSubmit={handleAddCluster} className="space-y-3 p-5 bg-gray-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add New Department</h4>
                <input type="text" placeholder="Department name" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} className={inputCls} required />
                <select value={newDeptUnitId} onChange={e => setNewDeptUnitId(e.target.value)} className={inputCls}>
                  <option value="">Select Unit (optional)</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button type="submit" disabled={clusterSaving}
                  className="w-full py-3 bg-slate-900 dark:bg-[#E31E24] text-white text-[11px] font-black uppercase tracking-widest hover:bg-[#E31E24] transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> {clusterSaving ? 'Adding...' : 'Add Department'}
                </button>
              </form>
              <div className="space-y-2">
                {departments.map(dept => {
                  const unitNames = (dept.unitIds?.length ? dept.unitIds : [dept.unitId]).map(id => units.find(u => u.id === id)?.name).filter(Boolean).join(', ');
                  return (
                    <div key={dept.id} className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {deletingDeptId !== dept.id ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-white">{dept.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{unitNames || 'Unassigned'}</p>
                          </div>
                          <button onClick={() => setDeletingDeptId(dept.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-all"><Trash2 size={15} /></button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-black text-slate-900 dark:text-white">Delete <span className="text-rose-500">"{dept.name}"</span>?</p>
                          <div className="flex gap-2">
                            <button onClick={() => setDeletingDeptId(null)} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase hover:bg-white dark:hover:bg-slate-700 transition-all">Cancel</button>
                            <button onClick={handleDeleteCluster} className="flex-1 py-2 bg-rose-500 text-white font-black text-[10px] uppercase hover:bg-rose-600 transition-all flex items-center justify-center gap-1"><Trash2 size={12} /> Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Employee Modal ── */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#E31E24] text-white"><UserPlus size={18} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Add New Employee</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Default password: <span className="text-[#E31E24]">Exord@123</span></p>
                </div>
              </div>
              <button onClick={() => setIsCreating(false)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreate} className="p-8 space-y-6 overflow-y-auto">
              {error && <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 text-xs font-black uppercase tracking-widest border border-rose-200 flex items-center gap-2"><ShieldAlert size={14} /> {error}</div>}
              {success && <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-black uppercase tracking-widest border border-emerald-200 flex items-center gap-2"><UserCheck size={14} /> {success}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Basic Information</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Full Name</label>
                      <div className="relative"><UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="text" required value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} placeholder="Full Legal Name" className={inputCls + ' pl-10'} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Employee ID</label>
                        <div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input type="text" required value={newEmployee.id} onChange={e => setNewEmployee({ ...newEmployee, id: e.target.value })} placeholder="E1001" className={inputCls + ' pl-10'} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">NID</label>
                        <div className="relative"><CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input type="text" required value={newEmployee.nid} onChange={e => setNewEmployee({ ...newEmployee, nid: e.target.value })} placeholder="National ID" className={inputCls + ' pl-10'} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Email Address</label>
                      <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="email" required value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} placeholder="employee@exordonline.com" className={inputCls + ' pl-10'} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Department</label>
                      <select
                        value={newEmployee.department}
                        onChange={e => {
                          const deptName = e.target.value;
                          const dept = departments.find(d => d.name === deptName);
                          const firstUnitId = dept?.unitIds?.[0] || dept?.unitId || '';
                          setNewEmployee({ ...newEmployee, department: deptName, unitId: firstUnitId });
                        }}
                        className={inputCls}
                      >
                        {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                        Unit <span className="text-slate-400 font-bold normal-case tracking-normal">(geofence / location)</span>
                      </label>
                      {units.length === 0 ? (
                        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center gap-2">
                          <AlertTriangle size={12} /> No units configured yet. Add units in Infrastructure.
                        </div>
                      ) : (
                        <>
                          <select
                            value={newEmployee.unitId || ''}
                            onChange={e => setNewEmployee({ ...newEmployee, unitId: e.target.value })}
                            className={inputCls}
                          >
                            {(() => {
                              const dept = departments.find(d => d.name === newEmployee.department);
                              const deptUnitIds = new Set(dept?.unitIds?.length ? dept.unitIds : (dept?.unitId ? [dept.unitId] : []));
                              const deptUnits = units.filter(u => deptUnitIds.has(u.id));
                              const otherUnits = units.filter(u => !deptUnitIds.has(u.id));
                              return (
                                <>
                                  {deptUnits.length > 0 && (
                                    <optgroup label={`— ${newEmployee.department || 'Department'} Units —`}>
                                      {deptUnits.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {otherUnits.length > 0 && (
                                    <optgroup label="— Other Units —">
                                      {otherUnits.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {deptUnits.length === 0 && (
                                    units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                                  )}
                                </>
                              );
                            })()}
                          </select>
                          {newEmployee.unitId && (() => {
                            const u = units.find(x => x.id === newEmployee.unitId);
                            return u ? (
                              <p className="text-[9px] text-slate-400 font-bold mt-1 flex items-center gap-1">
                                <MapPin size={9} /> {u.name} · {u.lat.toFixed(4)}, {u.lng.toFixed(4)} · Radius: {u.radius}m
                              </p>
                            ) : null;
                          })()}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Role</label>
                      <select
                        value={selectedCustomRoleId ? `custom::${selectedCustomRoleId}` : newEmployee.role as string}
                        onChange={e => {
                          const val = e.target.value;
                          if (val.startsWith('custom::')) {
                            setSelectedCustomRoleId(val.replace('custom::', ''));
                            setNewEmployee({ ...newEmployee, role: 'EMPLOYEE' as any });
                          } else {
                            setSelectedCustomRoleId('');
                            setNewEmployee({ ...newEmployee, role: val as any });
                          }
                        }}
                        className={inputCls}
                      >
                        <optgroup label="Standard Roles">
                          <option value="EMPLOYEE">Staff / Employee</option>
                          <option value="MANAGER">Manager</option>
                          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.DEVELOPER) && <option value="HR">HR</option>}
                          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.DEVELOPER) && <option value="CO_ADMIN">Co-Admin</option>}
                        </optgroup>
                        {customRoles.length > 0 && (
                          <optgroup label="Custom Roles">
                            {customRoles.map(cr => (
                              <option key={cr.id} value={`custom::${cr.id}`}>{cr.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {customRolesLoading && (
                        <p className="text-[9px] text-slate-400 mt-1">Loading custom roles…</p>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Base Salary (৳)</label>
                      <div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4" />
                        <input type="number" required value={newEmployee.baseSalary} onChange={e => setNewEmployee({ ...newEmployee, baseSalary: parseInt(e.target.value) || 0 })} className={inputCls + ' pl-10'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Family & Schedule</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Father's Name</label>
                      <input type="text" required value={newEmployee.fatherName} onChange={e => setNewEmployee({ ...newEmployee, fatherName: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Mother's Name</label>
                      <input type="text" required value={newEmployee.motherName} onChange={e => setNewEmployee({ ...newEmployee, motherName: e.target.value })} className={inputCls} />
                    </div>
                    {/* ✅ Weekend selector */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Weekend Days</label>
                      <WeekendSelector value={newEmployee.weekendDays} onChange={days => setNewEmployee({ ...newEmployee, weekendDays: days })} />
                      <p className="text-[9px] text-slate-400 mt-1">Selected: {newEmployee.weekendDays.length === 0 ? 'None' : newEmployee.weekendDays.join(', ')}</p>
                    </div>
                    {/* Join Date */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Join Date</label>
                      <input type="date" value={newEmployee.joinDate} onChange={e => setNewEmployee({ ...newEmployee, joinDate: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                </div>
                {/* ── Duty Schedule ── */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">⏰ Duty Schedule</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Check-In Time</label>
                      <input type="time" value={newEmployee.checkInTime} onChange={e => setNewEmployee({ ...newEmployee, checkInTime: e.target.value })} className={inputCls} />
                      <p className="text-[9px] text-slate-400 mt-1">Check-in opens 30 min before this time</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Check-Out Time</label>
                      <input type="time" value={newEmployee.checkOutTime} onChange={e => setNewEmployee({ ...newEmployee, checkOutTime: e.target.value })} className={inputCls} />
                      <p className="text-[9px] text-slate-400 mt-1">Arriving 5+ min late counts as late</p>
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Personal Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Gender</label>
                      <select value={newEmployee.gender} onChange={e => setNewEmployee({ ...newEmployee, gender: e.target.value })} className={inputCls}>
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Blood Group</label>
                      <select value={newEmployee.bloodGroup} onChange={e => setNewEmployee({ ...newEmployee, bloodGroup: e.target.value })} className={inputCls}>
                        <option value="">Select...</option>
                        {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Dress Size</label>
                      <select value={newEmployee.dressSize} onChange={e => setNewEmployee({ ...newEmployee, dressSize: e.target.value })} className={inputCls}>
                        <option value="">Select...</option>
                        {['XS','S','M','L','XL','XXL','XXXL'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Date of Birth</label>
                      <input type="date" value={newEmployee.dateOfBirth} onChange={e => setNewEmployee({ ...newEmployee, dateOfBirth: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Religion</label>
                      <select value={newEmployee.religion} onChange={e => setNewEmployee({ ...newEmployee, religion: e.target.value })} className={inputCls}>
                        <option value="">Select...</option>
                        {['Islam','Hinduism','Christianity','Buddhism','Other'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Marital Status</label>
                      <select value={newEmployee.maritalStatus} onChange={e => setNewEmployee({ ...newEmployee, maritalStatus: e.target.value })} className={inputCls}>
                        <option value="">Select...</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Nationality</label>
                      <input type="text" value={newEmployee.nationality} onChange={e => setNewEmployee({ ...newEmployee, nationality: e.target.value })} className={inputCls} placeholder="e.g. Bangladeshi" />
                    </div>
                  </div>
                </div>

                {/* Phone Numbers */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Phone Numbers</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Official Phone</label>
                      <input type="tel" value={newEmployee.phoneOfficial} onChange={e => setNewEmployee({ ...newEmployee, phoneOfficial: e.target.value })} className={inputCls} placeholder="+880..." />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Personal Phone</label>
                      <input type="tel" value={newEmployee.phonePersonal} onChange={e => setNewEmployee({ ...newEmployee, phonePersonal: e.target.value })} className={inputCls} placeholder="+880..." />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Alternative Number</label>
                      <input type="tel" value={newEmployee.phoneAlternative} onChange={e => setNewEmployee({ ...newEmployee, phoneAlternative: e.target.value })} className={inputCls} placeholder="+880..." />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Present Address</label>
                      <div className="relative"><MapPin className="absolute left-3 top-3.5 text-slate-400 w-4 h-4" />
                        <textarea required value={newEmployee.presentAddress} onChange={e => setNewEmployee({ ...newEmployee, presentAddress: e.target.value })} className={inputCls + ' pl-10 min-h-[90px] resize-none'} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Permanent Address</label>
                      <div className="relative"><MapPin className="absolute left-3 top-3.5 text-slate-400 w-4 h-4" />
                        <textarea required value={newEmployee.permanentAddress} onChange={e => setNewEmployee({ ...newEmployee, permanentAddress: e.target.value })} className={inputCls + ' pl-10 min-h-[90px] resize-none'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4 md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Emergency Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Contact Name</label>
                      <input type="text" value={newEmployee.emergencyName} onChange={e => setNewEmployee({ ...newEmployee, emergencyName: e.target.value })} className={inputCls} placeholder="Full name" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Relation</label>
                      <select value={newEmployee.emergencyRelation} onChange={e => setNewEmployee({ ...newEmployee, emergencyRelation: e.target.value })} className={inputCls}>
                        <option value="">Select...</option>
                        {['Father','Mother','Spouse','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Contact Number</label>
                      <input type="tel" value={newEmployee.emergencyContact} onChange={e => setNewEmployee({ ...newEmployee, emergencyContact: e.target.value })} className={inputCls} placeholder="+880..." />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">Address</label>
                      <input type="text" value={newEmployee.emergencyAddress} onChange={e => setNewEmployee({ ...newEmployee, emergencyAddress: e.target.value })} className={inputCls} placeholder="Emergency contact address" />
                    </div>
                  </div>
                </div>

                {/* ── NID Photo Upload — OPTIONAL ── */}
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      NID / Identity Document
                      <span className="ml-2 text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">(optional — can be uploaded later)</span>
                    </h4>
                  </div>
                  <input ref={nidPhotoRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleNidPhotoSelect} />
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => nidPhotoRef.current?.click()} disabled={nidPhotoUploading}
                      className={`flex items-center gap-2 px-4 py-2.5 border-2 text-[11px] font-black uppercase tracking-widest transition-all ${
                        nidPhotoUrl
                          ? 'border-emerald-400 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10'
                          : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:border-[#E31E24] hover:text-[#E31E24]'
                      }`}>
                      {nidPhotoUploading
                        ? <><Loader2 size={14} className="animate-spin" /> Uploading...</>
                        : nidPhotoUrl
                          ? <><CheckCircle2 size={14} /> {nidPhotoName || 'NID Uploaded'}</>
                          : <><ImageIcon size={14} /> Upload NID Photo / PDF</>
                      }
                    </button>
                    {nidPhotoUrl && (
                      <button type="button" onClick={() => { setNidPhotoUrl(null); setNidPhotoName(''); }}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-all" title="Remove">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">Accepted: JPG, PNG, WEBP, PDF — max 500MB. Not required now — employee can submit after joining.</p>
                </div>

                {/* ── Document Upload Deadline ── */}
                {canManageDeadline && (
                  <div className="space-y-3 md:col-span-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <CalendarClock size={13} className="text-amber-500" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Document Upload Deadline
                        <span className="ml-2 text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">(optional)</span>
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="date"
                        value={newEmployeeDocDeadline}
                        onChange={e => setNewEmployeeDocDeadline(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="px-3 py-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 focus:border-amber-400 transition-all"
                      />
                      {newEmployeeDocDeadline && (
                        <button type="button" onClick={() => setNewEmployeeDocDeadline('')}
                          className="p-1.5 text-slate-400 hover:text-rose-500 transition-all">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      If set, the employee must upload their documents by this date or their account will be locked until they comply.
                    </p>
                  </div>
                )}

                {/* ── Extra Documents ── */}
                <div className="space-y-3 md:col-span-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Other Documents <span className="text-slate-300 dark:text-slate-600 font-medium normal-case tracking-normal">(optional)</span></h4>

                  {/* Uploaded docs list */}
                  {extraDocs.length > 0 && (
                    <div className="space-y-2">
                      {extraDocs.map((doc, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <FileText size={14} className="text-[#E31E24] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">{doc.label}</p>
                            <p className="text-[10px] text-slate-400 truncate">{doc.name}</p>
                          </div>
                          <button type="button" onClick={() => setExtraDocs(prev => prev.filter((_, j) => j !== i))}
                            className="p-1.5 text-slate-400 hover:text-rose-500 transition-all flex-shrink-0">
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Label input before upload */}
                  {showDocLabelInput && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">
                        What document is this? <span className="text-slate-500 font-medium normal-case tracking-normal">e.g. "Birth Certificate", "Driving License", "Academic Certificate"</span>
                      </p>
                      <input type="text" placeholder="Document label / description" value={pendingDocLabel}
                        onChange={e => setPendingDocLabel(e.target.value)}
                        className={inputCls} />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setShowDocLabelInput(false); setPendingDocFile(null); setPendingDocLabel(''); }}
                          className="flex-1 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">
                          Cancel
                        </button>
                        <button type="button" onClick={handleExtraDocUpload} disabled={extraDocUploading || !pendingDocLabel.trim()}
                          className="flex-[2] py-2.5 bg-[#E31E24] text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                          {extraDocUploading ? <><Loader2 size={12} className="animate-spin" /> Uploading...</> : <><Upload size={12} /> Upload Document</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Add document button */}
                  {!showDocLabelInput && (
                    <>
                      <input ref={extraDocRef} type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        className="hidden" onChange={handleExtraDocSelect} />
                      <button type="button" onClick={() => extraDocRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 text-[11px] font-black uppercase tracking-widest hover:border-[#E31E24] hover:text-[#E31E24] transition-all">
                        <Paperclip size={14} /> Add Document
                      </button>
                    </>
                  )}

                  {docUploadError && (
                    <p className="text-[11px] text-rose-500 font-black flex items-center gap-1.5">
                      <ShieldAlert size={12} /> {docUploadError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 dark:bg-[#E31E24] text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                  <UserCheck size={15} /> Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Employee Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#E31E24] text-white"><Edit2 size={16} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Edit Employee</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID: {editingUser.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>

            <form onSubmit={handleUpdate} className="p-8 space-y-6 overflow-y-auto">

              {/* ✅ Avatar upload */}
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
                    {editingUser.avatar
                      ? <img src={editingUser.avatar} alt="avatar" className="w-full h-full object-cover" key={editingUser.avatar} />
                      : <span className="text-slate-500 dark:text-slate-300 font-black text-2xl">{editingUser.name.charAt(0)}</span>
                    }
                  </div>
                  <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                    className="absolute -bottom-2 -right-2 p-2 bg-[#E31E24] text-white shadow-lg hover:bg-red-700 transition-all" title="Upload avatar">
                    {avatarUploading
                      ? <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin" />
                      : <Camera size={12} />
                    }
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleAvatarUpload(e, editingUser.id)} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{editingUser.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{editingUser.email}</p>
                  {avatarError && <p className="text-[10px] text-rose-500 font-bold mt-1">{avatarError}</p>}
                  {!avatarError && <p className="text-[10px] text-slate-400 mt-1">Click camera to update profile photo (max 2MB)</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Full Name</label>
                  <input type="text" required value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Email</label>
                  <input type="email" required value={editingUser.email} onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Role</label>
                  <div className="flex border border-slate-200 dark:border-slate-700 overflow-hidden flex-wrap">
                    {[UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.HR, UserRole.CO_ADMIN, UserRole.ADMIN, UserRole.DEVELOPER].map(r => (
                      <button key={r} type="button" onClick={() => setEditingUser({ ...editingUser, role: r })}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all min-w-[80px] ${editingUser.role === r ? 'bg-[#E31E24] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                        {r === UserRole.EMPLOYEE ? 'Staff' : r === UserRole.CO_ADMIN ? 'Co-Admin' : r === UserRole.DEVELOPER ? 'Developer' : r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Department</label>
                  <select value={editingUser.department} onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })} className={inputCls}>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Unit <span className="text-slate-400 font-bold normal-case tracking-normal">(geofence location)</span>
                  </label>
                  {(() => {
                    const dept = departments.find(d => d.name === editingUser.department);
                    const deptUnitIds = new Set(dept?.unitIds?.length ? dept.unitIds : (dept?.unitId ? [dept.unitId] : []));
                    const deptUnits = units.filter(u => deptUnitIds.has(u.id));
                    const otherUnits = units.filter(u => !deptUnitIds.has(u.id));
                    const currentUnit = units.find(u =>
                      Math.abs(u.lat - (editingUser.unitLocation?.lat || 0)) < 0.001 &&
                      Math.abs(u.lng - (editingUser.unitLocation?.lng || 0)) < 0.001
                    );
                    if (units.length === 0) return (
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 text-[10px] font-bold flex items-center gap-2">
                        <AlertTriangle size={12} /> No units configured.
                      </div>
                    );
                    return (
                      <select
                        value={currentUnit?.id || deptUnits[0]?.id || units[0]?.id || ''}
                        onChange={e => {
                          const u = units.find(x => x.id === e.target.value);
                          if (u) setEditingUser({ ...editingUser, unitLocation: { lat: u.lat, lng: u.lng } });
                        }}
                        className={inputCls}
                      >
                        {deptUnits.length > 0 && (
                          <optgroup label={`— ${editingUser.department} Units —`}>
                            {deptUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </optgroup>
                        )}
                        {otherUnits.length > 0 && (
                          <optgroup label="— Other Units —">
                            {otherUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                    );
                  })()}
                </div>
                {canSeeSensitive && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Base Salary (৳)</label>
                    <div className="relative"><DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                      <input type="number" required value={editingUser.baseSalary} onChange={(e) => setEditingUser({ ...editingUser, baseSalary: parseInt(e.target.value) || 0 })} className={inputCls + ' pl-9'} />
                    </div>
                  </div>
                )}
                {canSeeSensitive && (<div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Father's Name</label>
                  <input type="text" value={editingUser.fatherName || ''} onChange={(e) => setEditingUser({ ...editingUser, fatherName: e.target.value })} className={inputCls} />
                </div>)}
                {canSeeSensitive && (<div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Mother's Name</label>
                  <input type="text" value={editingUser.motherName || ''} onChange={(e) => setEditingUser({ ...editingUser, motherName: e.target.value })} className={inputCls} />
                </div>)}
                {canSeeSensitive && (<div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">NID Number</label>
                  <input type="text" value={editingUser.nid || ''} onChange={(e) => setEditingUser({ ...editingUser, nid: e.target.value })} className={inputCls} />
                </div>)}
                {/* ✅ Weekend selector in edit form */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Weekend Days</label>
                  <WeekendSelector
                    value={(editingUser.weekendDays || ['Friday', 'Saturday']) as WeekDay[]}
                    onChange={days => setEditingUser({ ...editingUser, weekendDays: days })}
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    Selected: {(editingUser.weekendDays || []).length === 0 ? 'None' : (editingUser.weekendDays || []).join(', ')}
                  </p>
                </div>
                {canSeeSensitive && (<div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Present Address</label>
                  <textarea value={editingUser.presentAddress || ''} onChange={(e) => setEditingUser({ ...editingUser, presentAddress: e.target.value })} className={inputCls + ' min-h-[80px] resize-none'} />
                </div>)}
                {canSeeSensitive && (<div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Permanent Address</label>
                  <textarea value={editingUser.permanentAddress || ''} onChange={(e) => setEditingUser({ ...editingUser, permanentAddress: e.target.value })} className={inputCls + ' min-h-[80px] resize-none'} />
                </div>)}

                {/* Extended fields — sensitive only */}
                {canSeeSensitive && (<>
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Personal Details</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Gender</label>
                        <select value={editingUser.gender || ''} onChange={e => setEditingUser({ ...editingUser, gender: e.target.value })} className={inputCls}>
                          <option value="">Select...</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Blood Group</label>
                        <select value={editingUser.bloodGroup || ''} onChange={e => setEditingUser({ ...editingUser, bloodGroup: e.target.value })} className={inputCls}>
                          <option value="">Select...</option>
                          {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Dress Size</label>
                        <select value={editingUser.dressSize || ''} onChange={e => setEditingUser({ ...editingUser, dressSize: e.target.value })} className={inputCls}>
                          <option value="">Select...</option>
                          {['XS','S','M','L','XL','XXL','XXXL'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Date of Birth</label>
                        <input type="date" value={editingUser.dateOfBirth || ''} onChange={e => setEditingUser({ ...editingUser, dateOfBirth: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Religion</label>
                        <select value={editingUser.religion || ''} onChange={e => setEditingUser({ ...editingUser, religion: e.target.value })} className={inputCls}>
                          <option value="">Select...</option>
                          {['Islam','Hinduism','Christianity','Buddhism','Other'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Marital Status</label>
                        <select value={editingUser.maritalStatus || ''} onChange={e => setEditingUser({ ...editingUser, maritalStatus: e.target.value })} className={inputCls}>
                          <option value="">Select...</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Nationality</label>
                        <input type="text" value={editingUser.nationality || ''} onChange={e => setEditingUser({ ...editingUser, nationality: e.target.value })} className={inputCls} />
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Phone Numbers</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Official</label>
                        <input type="tel" value={editingUser.phoneOfficial || ''} onChange={e => setEditingUser({ ...editingUser, phoneOfficial: e.target.value })} className={inputCls} placeholder="+880..." />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Personal</label>
                        <input type="tel" value={editingUser.phonePersonal || ''} onChange={e => setEditingUser({ ...editingUser, phonePersonal: e.target.value })} className={inputCls} placeholder="+880..." />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Alternative</label>
                        <input type="tel" value={editingUser.phoneAlternative || ''} onChange={e => setEditingUser({ ...editingUser, phoneAlternative: e.target.value })} className={inputCls} placeholder="+880..." />
                      </div>
                    </div>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Emergency Contact</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Name</label>
                        <input type="text" value={editingUser.emergencyName || ''} onChange={e => setEditingUser({ ...editingUser, emergencyName: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Relation</label>
                        <select value={editingUser.emergencyRelation || ''} onChange={e => setEditingUser({ ...editingUser, emergencyRelation: e.target.value })} className={inputCls}>
                          <option value="">Select...</option>
                          {['Father','Mother','Spouse','Sibling','Child','Friend','Other'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Contact Number</label>
                        <input type="tel" value={editingUser.emergencyContact || ''} onChange={e => setEditingUser({ ...editingUser, emergencyContact: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Address</label>
                        <input type="text" value={editingUser.emergencyAddress || ''} onChange={e => setEditingUser({ ...editingUser, emergencyAddress: e.target.value })} className={inputCls} />
                      </div>
                    </div>
                  </div>
                </>)}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 dark:bg-[#E31E24] text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2">
                  <Save size={14} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Employee Detail View Modal ── */}
      {viewingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-500"><Eye size={18} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Employee Details</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Read-only view · ID: {viewingUser.id}</p>
                </div>
              </div>
              <button onClick={() => setViewingUser(null)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8">
              {/* Avatar + Name block */}
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-[#E31E24] flex items-center justify-center ring-4 ring-red-100 dark:ring-red-900/30">
                  {viewingUser.avatar
                    ? <img src={viewingUser.avatar} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-white font-black text-3xl">{viewingUser.name.charAt(0)}</span>
                  }
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white">{viewingUser.name}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
                      viewingUser.role === UserRole.ADMIN    ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' :
                      viewingUser.role === UserRole.CO_ADMIN ? 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/30' :
                      viewingUser.role === UserRole.HR       ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' :
                      viewingUser.role === UserRole.MANAGER  ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/30' :
                      'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                    }`}>{viewingUser.role === UserRole.CO_ADMIN ? 'Co-Admin' : viewingUser.role}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{viewingUser.department}</span>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5">{viewingUser.id}</span>
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Email', value: viewingUser.email, icon: <Mail size={14} /> },
                  { label: 'Department', value: viewingUser.department, icon: <Building2 size={14} /> },
                  ...(canSeeSensitive ? [
                    { label: "Father's Name",   value: viewingUser.fatherName || '—',    icon: <UserIcon size={14} /> },
                    { label: "Mother's Name",   value: viewingUser.motherName || '—',    icon: <UserIcon size={14} /> },
                    { label: 'NID Number',      value: viewingUser.nid || '—',           icon: <CreditCard size={14} /> },
                    { label: 'Base Salary',     value: formatCurrency(viewingUser.baseSalary), icon: <DollarSign size={14} /> },
                    { label: 'Gender',          value: viewingUser.gender || '—',        icon: <UserIcon size={14} /> },
                    { label: 'Blood Group',     value: viewingUser.bloodGroup || '—',    icon: <Shield size={14} /> },
                    { label: 'Dress Size',      value: viewingUser.dressSize || '—',     icon: <UserIcon size={14} /> },
                    { label: 'Date of Birth',   value: viewingUser.dateOfBirth || '—',   icon: <Shield size={14} /> },
                    { label: 'Religion',        value: viewingUser.religion || '—',      icon: <Shield size={14} /> },
                    { label: 'Marital Status',  value: viewingUser.maritalStatus || '—', icon: <UserIcon size={14} /> },
                    { label: 'Nationality',     value: viewingUser.nationality || '—',   icon: <Shield size={14} /> },
                    { label: 'Official Phone',  value: viewingUser.phoneOfficial || '—', icon: <Mail size={14} /> },
                    { label: 'Personal Phone',  value: viewingUser.phonePersonal || '—', icon: <Mail size={14} /> },
                    { label: 'Alt. Number',     value: viewingUser.phoneAlternative || '—', icon: <Mail size={14} /> },
                  ] : []),
                  { label: 'Weekend Days', value: (viewingUser.weekendDays || ['Friday', 'Saturday']).join(' & '), icon: <Shield size={14} /> },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                      {item.icon}
                      <p className="text-[9px] font-black uppercase tracking-widest">{item.label}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white break-words">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Addresses (sensitive only) */}
              {canSeeSensitive && (viewingUser.presentAddress || viewingUser.permanentAddress) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {viewingUser.presentAddress && (
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-slate-400 mb-1.5"><MapPin size={14} /><p className="text-[9px] font-black uppercase tracking-widest">Present Address</p></div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-pre-line">{viewingUser.presentAddress}</p>
                    </div>
                  )}
                  {viewingUser.permanentAddress && (
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-slate-400 mb-1.5"><MapPin size={14} /><p className="text-[9px] font-black uppercase tracking-widest">Permanent Address</p></div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white whitespace-pre-line">{viewingUser.permanentAddress}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Emergency Contact (sensitive only) */}
              {canSeeSensitive && (viewingUser.emergencyName || viewingUser.emergencyContact) && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Emergency Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Name',     value: viewingUser.emergencyName || '—' },
                      { label: 'Relation', value: viewingUser.emergencyRelation || '—' },
                      { label: 'Phone',    value: viewingUser.emergencyContact || '—' },
                      { label: 'Address',  value: viewingUser.emergencyAddress || '—' },
                    ].map(item => (
                      <div key={item.label} className="p-4 bg-gray-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Document Deadline (canManageDeadline only) ── */}
              {canManageDeadline && (
                <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={15} className="text-amber-500" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Document Upload Deadline</p>
                  </div>

                  {/* Current deadline status */}
                  {viewingUser.docDeadline ? (
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 px-3 py-2 text-xs font-bold ${
                        new Date(viewingUser.docDeadline) < new Date()
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                          : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      }`}>
                        <Clock size={12} />
                        {new Date(viewingUser.docDeadline) < new Date() ? 'EXPIRED — ' : 'Deadline: '}
                        {new Date(viewingUser.docDeadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                      <button
                        onClick={() => handleSetDeadline(viewingUser.id, '')}
                        disabled={deadlineSaving}
                        className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-700 transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium">No deadline set — employee can upload documents at any time.</p>
                  )}

                  {/* Deadline setter */}
                  {deadlinePickerUserId === viewingUser.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={deadlinePickerValue}
                        onChange={e => setDeadlinePickerValue(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700 text-sm font-bold text-slate-900 dark:text-white focus:border-amber-500 transition-all"
                      />
                      <button
                        onClick={() => handleSetDeadline(viewingUser.id, deadlinePickerValue)}
                        disabled={!deadlinePickerValue || deadlineSaving}
                        className="px-4 py-2 bg-amber-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        {deadlineSaving ? <Loader2 size={12} className="animate-spin" /> : <ClipboardCheck size={12} />}
                        Set
                      </button>
                      <button
                        onClick={() => { setDeadlinePickerUserId(null); setDeadlinePickerValue(''); setDeadlineMsg(''); }}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setDeadlinePickerUserId(viewingUser.id);
                        setDeadlinePickerValue(viewingUser.docDeadline ? viewingUser.docDeadline.split('T')[0] : '');
                        setDeadlineMsg('');
                      }}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all"
                    >
                      <CalendarClock size={12} /> {viewingUser.docDeadline ? 'Change Deadline' : 'Set Deadline'}
                    </button>
                  )}
                  {deadlineMsg && deadlinePickerUserId === viewingUser.id && (
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{deadlineMsg}</p>
                  )}

                  {/* Docs status */}
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 pt-1">
                    <FileText size={11} />
                    {viewingUser.documents && (viewingUser.documents as any[]).length > 0
                      ? <span className="text-emerald-600 dark:text-emerald-400">✓ {(viewingUser.documents as any[]).length} document(s) uploaded</span>
                      : <span className="text-rose-500">No documents uploaded yet</span>
                    }
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                {viewingUser.id !== currentUser?.id && (
                  <button onClick={() => { setViewingUser(null); handleMessageClick(viewingUser.id); }}
                    className="flex items-center gap-2 px-5 py-3 bg-blue-500 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all">
                    <MessageSquare size={14} /> Message
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => { setViewingUser(null); setEditingUser({ ...viewingUser }); setAvatarError(''); }}
                    className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all">
                    <Edit2 size={14} /> Edit Employee
                  </button>
                )}
                <button onClick={() => setViewingUser(null)}
                  className="ml-auto px-5 py-3 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Change Requests Panel ── */}
      {showPCRPanel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col rounded-[2rem]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Profile Change Requests</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  {profileChangeRequests.filter((r: any) => r.status === 'PENDING').length} pending
                </p>
              </div>
              <button onClick={() => setShowPCRPanel(false)} className="p-2 text-slate-400 hover:text-red-600 transition-all"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
              {profileChangeRequests.length === 0 && (
                <div className="text-center py-16 text-slate-400 text-sm font-bold">No profile change requests yet.</div>
              )}
              {profileChangeRequests.map((req: any) => (
                <div key={req.id} className={`p-6 space-y-3 ${req.status === 'PENDING' ? 'bg-amber-50/30 dark:bg-amber-900/5' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900 dark:text-white text-sm">{req.user_name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{req.department} · {new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-xl flex-shrink-0 ${
                      req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                      req.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>{req.status}</span>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(req.field_changes).map(([field, change]: [string, any]) => (
                      <div key={field} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-xs">
                        <span className="font-black text-slate-500 w-36 flex-shrink-0">{field}</span>
                        <span className="text-slate-400 line-through truncate max-w-[100px]">{change.old || '—'}</span>
                        <span className="text-slate-300">→</span>
                        <span className="font-black text-slate-900 dark:text-white truncate">{change.new}</span>
                      </div>
                    ))}
                  </div>
                  {req.reason && <p className="text-xs text-slate-500 italic">Reason: {req.reason}</p>}
                  {req.review_note && <p className="text-xs text-slate-500 italic">Review note: {req.review_note}</p>}
                  {req.reviewed_by && <p className="text-[10px] text-slate-400">Reviewed by {req.reviewed_by}</p>}
                  {req.status === 'PENDING' && (
                    <div className="space-y-2">
                      {rejectingPCRId === req.id ? (
                        <div className="space-y-2">
                          <input type="text" placeholder="Rejection reason (optional)" value={pcrRejectNote}
                            onChange={e => setPCRRejectNote(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-[#E31E24]" />
                          <div className="flex gap-2">
                            <button onClick={() => { setRejectingPCRId(null); setPCRRejectNote(''); }}
                              className="flex-1 py-2 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl">Cancel</button>
                            <button onClick={async () => { await reviewProfileChangeRequest(req.id, 'REJECTED', pcrRejectNote); setRejectingPCRId(null); setPCRRejectNote(''); }}
                              className="flex-[2] py-2 text-xs font-black uppercase text-white bg-rose-500 rounded-xl active:scale-95 transition-all">Confirm Reject</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={async () => await reviewProfileChangeRequest(req.id, 'APPROVED')}
                            className="flex-1 py-2.5 text-xs font-black uppercase text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl active:scale-95 transition-all">
                            ✓ Approve & Apply
                          </button>
                          <button onClick={() => setRejectingPCRId(req.id)}
                            className="flex-1 py-2.5 text-xs font-black uppercase text-white bg-rose-500 hover:bg-rose-600 rounded-xl active:scale-95 transition-all">
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceView;
