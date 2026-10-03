/**
 * AssetView.tsx — Exord Online HRM v2
 * Asset & Inventory Management
 *  - Visible only to: ADMIN, CO_ADMIN, and dept members of Marketing/Inventory
 *  - Add assets manually or via barcode scan (BarcodeDetector API + camera fallback)
 *  - Track location: which office/unit the asset is at
 *  - Transfer assets between offices
 *  - Full audit log per asset
 *  - Barcode stored and searchable
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import {
  Package, Plus, Search, QrCode, X, ChevronDown,
  MapPin, ArrowRightLeft, Clock, Tag, Filter,
  Loader2, Camera, CheckCircle, AlertCircle, Edit2,
  Trash2, BarChart2, Building2, RefreshCw, ScanLine,
} from 'lucide-react';
import { supabase } from '../serverOwnedClient';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Asset {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  description?: string;
  location_unit: string;   // unit/office name
  location_detail?: string; // e.g. "Room 3", "Floor 2"
  department: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'DISPOSED';
  quantity: number;
  unit_price?: number;
  added_by: string;
  added_by_name: string;
  created_at: string;
  updated_at: string;
}

interface AssetLog {
  id: string;
  asset_id: string;
  action: 'ADDED' | 'TRANSFERRED' | 'UPDATED' | 'DISPOSED' | 'MAINTENANCE';
  from_location?: string;
  to_location?: string;
  note?: string;
  done_by_name: string;
  created_at: string;
}

const CATEGORIES = ['Electronics', 'Furniture', 'Vehicle', 'Tools', 'Stationery', 'Software', 'Equipment', 'Other'];
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  INACTIVE:    'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  MAINTENANCE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DISPOSED:    'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

// ── Barcode Scanner Modal ─────────────────────────────────────────────────────
const BarcodeScanner: React.FC<{ onDetect: (code: string) => void; onClose: () => void }> = ({ onDetect, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(true);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;

        // Use BarcodeDetector if available (Chrome Android / modern browsers)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e'] });
          intervalRef.current = setInterval(async () => {
            if (!videoRef.current || !scanning) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                clearInterval(intervalRef.current);
                setScanning(false);
                onDetect(barcodes[0].rawValue);
              }
            } catch { /* frame not ready yet */ }
          }, 300);
        } else {
          setError('Live scan not supported on this browser. Use manual entry below.');
        }
      } catch {
        setError('Camera access denied. Use manual entry below.');
      }
    };
    startCamera();
    return () => {
      clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ScanLine size={18} className="text-[#E31E24]" />
            <span className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wide">Scan Barcode</span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X size={18} /></button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black" style={{ height: 240 }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {/* Scan frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-48 h-32">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#E31E24] rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#E31E24] rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#E31E24] rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#E31E24] rounded-br-lg" />
              {scanning && <div className="absolute left-0 right-0 h-0.5 bg-[#E31E24] opacity-80 animate-[scanLine_1.5s_ease-in-out_infinite]" style={{ top: '50%' }} />}
            </div>
          </div>
          {scanning && !error && (
            <p className="absolute bottom-3 left-0 right-0 text-center text-white/70 text-xs font-bold">Point camera at barcode</p>
          )}
        </div>

        {/* Error / manual fallback */}
        <div className="p-4 space-y-3">
          {error && <p className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl">{error}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Or type barcode manually..."
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && manualCode.trim()) { onDetect(manualCode.trim()); } }}
              className="flex-1 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none"
            />
            <button
              onClick={() => { if (manualCode.trim()) onDetect(manualCode.trim()); }}
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 bg-[#E31E24] text-white text-sm font-black rounded-xl disabled:opacity-50 active:scale-95 transition-all"
            >
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Transfer Modal ─────────────────────────────────────────────────────────────
const TransferModal: React.FC<{
  asset: Asset;
  units: { name: string }[];
  onConfirm: (toUnit: string, detail: string, note: string) => void;
  onClose: () => void;
}> = ({ asset, units, onConfirm, onClose }) => {
  const [toUnit, setToUnit] = useState('');
  const [detail, setDetail] = useState('');
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={16} className="text-[#E31E24]" />
            <span className="font-black text-sm text-slate-900 dark:text-white">Transfer Asset</span>
          </div>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</p>
            <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{asset.name}</p>
            <p className="text-xs text-slate-400">Currently at: <span className="font-bold text-slate-600 dark:text-slate-300">{asset.location_unit}</span></p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Transfer To *</label>
            <select value={toUnit} onChange={e => setToUnit(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
              <option value="">Select office / unit...</option>
              {units.filter(u => u.name !== asset.location_unit).map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
              <option value="__custom__">Other location...</option>
            </select>
            {toUnit === '__custom__' && (
              <input type="text" placeholder="Type location name..." value={detail} onChange={e => setDetail(e.target.value)}
                className="w-full mt-2 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
            )}
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Room / Floor (optional)</label>
            <input type="text" placeholder="e.g. Room 3, Floor 2" value={toUnit !== '__custom__' ? detail : ''}
              onChange={e => setDetail(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Reason</label>
            <input type="text" placeholder="Transfer reason..." value={note} onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">Cancel</button>
            <button
              onClick={() => { if (toUnit && toUnit !== '__custom__') onConfirm(toUnit, detail, note); else if (toUnit === '__custom__' && detail) onConfirm(detail, '', note); }}
              disabled={!toUnit || (toUnit === '__custom__' && !detail)}
              className="flex-[2] py-3 text-xs font-black uppercase text-white bg-[#E31E24] rounded-2xl disabled:opacity-50 active:scale-95 transition-all"
            >
              Confirm Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main View ─────────────────────────────────────────────────────────────────
const AssetView: React.FC = () => {
  const { currentUser, units, users, hasPermission } = useHRM();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [logs, setLogs] = useState<AssetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [transferAsset, setTransferAsset] = useState<Asset | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState<Partial<Asset>>({});
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);

  // Add form state
  const [form, setForm] = useState({
    name: '', barcode: '', category: 'Electronics', description: '',
    location_unit: '', location_detail: '', department: '',
    status: 'ACTIVE' as Asset['status'], quantity: 1, unit_price: '',
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.CO_ADMIN;
  // Marketing & Inventory dept members (any role) and permission-granted users can manage
  const isAssetDept = ['Marketing', 'Inventory'].includes(currentUser?.department || '')
    || (currentUser ? hasPermission(currentUser.id, 'assets') : false);
  const canSeeAll = isAdmin || isAssetDept;
  const canManage = canSeeAll;
  // Edit & delete: Admins, Co-Admins, and Marketing/Inventory dept Managers (or higher)
  const canEditDelete = isAdmin
    || (isAssetDept && (
      currentUser?.role === UserRole.MANAGER ||
      currentUser?.role === UserRole.HR ||
      currentUser?.role === UserRole.CO_ADMIN ||
      currentUser?.role === UserRole.ADMIN
    ));

  // ── Hardware barcode reader support ──────────────────────────────────────────
  // USB/Bluetooth scanners type the barcode rapidly (< 100ms/char) then Enter
  useEffect(() => {
    if (!canManage) return;
    let buffer = '';
    let lastTime = 0;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const now = Date.now();
      if (now - lastTime > 100) buffer = '';
      lastTime = now;
      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          const code = buffer.trim();
          const existing = assets.find(a => a.barcode === code);
          if (existing) { setSelectedAsset(existing); showToast(`Found: ${existing.name}`); }
          else { setForm(f => ({ ...f, barcode: code })); setShowAdd(true); showToast('New barcode — fill in details'); }
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canManage, assets]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadAssets = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('assets').select('*').order('created_at', { ascending: false });
    // Only non-asset-dept regular employees are scoped to their own dept
    if (!canSeeAll && currentUser?.department) {
      q = q.eq('department', currentUser.department);
    }
    const { data, error } = await q;
    if (error) { showToast('Failed to load assets', false); }
    else setAssets(data || []);
    setLoading(false);
  }, [canSeeAll, currentUser?.department]);

  const loadLogs = useCallback(async (assetId: string) => {
    const { data } = await supabase.from('asset_logs').select('*')
      .eq('asset_id', assetId).order('created_at', { ascending: false }).limit(50);
    setLogs(data || []);
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);
  useEffect(() => { if (selectedAsset) loadLogs(selectedAsset.id); }, [selectedAsset, loadLogs]);

  // ── Add asset ───────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.name.trim() || !form.location_unit || !form.department) return;
    setSaving(true);
    const id = `AST-${Date.now()}`;
    const now = new Date().toISOString();
    const row = {
      id, name: form.name.trim(), barcode: form.barcode.trim() || null,
      category: form.category, description: form.description.trim() || null,
      location_unit: form.location_unit, location_detail: form.location_detail.trim() || null,
      department: form.department, status: form.status,
      quantity: form.quantity, unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      added_by: currentUser!.id, added_by_name: currentUser!.name,
      created_at: now, updated_at: now,
    };
    const { error } = await supabase.from('assets').insert(row);
    if (error) { showToast('Failed to save asset', false); }
    else {
      // Log the add
      await supabase.from('asset_logs').insert({
        id: `AL-${Date.now()}`, asset_id: id, action: 'ADDED',
        to_location: form.location_unit, note: 'Asset added',
        done_by_name: currentUser!.name, created_at: now,
      });
      setAssets(prev => [row as Asset, ...prev]);
      setShowAdd(false);
      setForm({ name: '', barcode: '', category: 'Electronics', description: '', location_unit: '', location_detail: '', department: '', status: 'ACTIVE', quantity: 1, unit_price: '' });
      showToast('Asset added successfully');
    }
    setSaving(false);
  };

  // ── Transfer ────────────────────────────────────────────────────────────────
  const handleTransfer = async (toUnit: string, detail: string, note: string) => {
    if (!transferAsset) return;
    setSaving(true);
    const now = new Date().toISOString();
    await supabase.from('assets').update({ location_unit: toUnit, location_detail: detail || null, updated_at: now }).eq('id', transferAsset.id);
    await supabase.from('asset_logs').insert({
      id: `AL-${Date.now()}`, asset_id: transferAsset.id, action: 'TRANSFERRED',
      from_location: transferAsset.location_unit, to_location: toUnit,
      note: note || null, done_by_name: currentUser!.name, created_at: now,
    });
    setAssets(prev => prev.map(a => a.id === transferAsset.id ? { ...a, location_unit: toUnit, location_detail: detail || undefined, updated_at: now } : a));
    if (selectedAsset?.id === transferAsset.id) loadLogs(transferAsset.id);
    setTransferAsset(null);
    showToast('Asset transferred');
    setSaving(false);
  };

  // ── Status change ────────────────────────────────────────────────────────────
  const handleStatusChange = async (asset: Asset, status: Asset['status']) => {
    const now = new Date().toISOString();
    await supabase.from('assets').update({ status, updated_at: now }).eq('id', asset.id);
    await supabase.from('asset_logs').insert({
      id: `AL-${Date.now()}`, asset_id: asset.id, action: status === 'DISPOSED' ? 'DISPOSED' : 'UPDATED',
      note: `Status changed to ${status}`, done_by_name: currentUser!.name, created_at: now,
    });
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status, updated_at: now } : a));
    if (selectedAsset?.id === asset.id) { setSelectedAsset(prev => prev ? { ...prev, status } : prev); loadLogs(asset.id); }
    showToast('Status updated');
  };

  // ── Edit asset ──────────────────────────────────────────────────────────────
  const openEdit = (asset: Asset) => {
    setEditForm({
      name: asset.name,
      barcode: asset.barcode || '',
      category: asset.category,
      description: asset.description || '',
      location_unit: asset.location_unit,
      location_detail: asset.location_detail || '',
      department: asset.department,
      status: asset.status,
      quantity: asset.quantity,
      unit_price: asset.unit_price,
    });
    setEditAsset(asset);
  };

  const handleEdit = async () => {
    if (!editAsset) return;
    setSaving(true);
    const now = new Date().toISOString();
    const updates: any = {
      name: editForm.name?.trim(),
      barcode: editForm.barcode?.trim() || null,
      category: editForm.category,
      description: editForm.description?.trim() || null,
      location_unit: editForm.location_unit,
      location_detail: editForm.location_detail?.trim() || null,
      department: editForm.department,
      status: editForm.status,
      quantity: editForm.quantity,
      unit_price: editForm.unit_price || null,
      updated_at: now,
    };
    const { error } = await supabase.from('assets').update(updates).eq('id', editAsset.id);
    if (error) {
      showToast('Failed to update asset', false);
    } else {
      await supabase.from('asset_logs').insert({
        id: `AL-${Date.now()}`, asset_id: editAsset.id, action: 'UPDATED',
        note: `Asset edited by ${currentUser!.name}`, done_by_name: currentUser!.name, created_at: now,
      });
      setAssets(prev => prev.map(a => a.id === editAsset.id ? { ...a, ...updates } : a));
      if (selectedAsset?.id === editAsset.id) {
        setSelectedAsset(prev => prev ? { ...prev, ...updates } : prev);
        loadLogs(editAsset.id);
      }
      setEditAsset(null);
      showToast('Asset updated successfully');
    }
    setSaving(false);
  };

  // ── Delete asset ─────────────────────────────────────────────────────────────
  const handleDelete = async (asset: Asset) => {
    setSaving(true);
    const now = new Date().toISOString();
    // Log before deleting so the log isn't orphaned
    await supabase.from('asset_logs').insert({
      id: `AL-${Date.now()}`, asset_id: asset.id, action: 'DISPOSED',
      note: `Asset permanently deleted by ${currentUser!.name}`, done_by_name: currentUser!.name, created_at: now,
    });
    const { error } = await supabase.from('assets').delete().eq('id', asset.id);
    if (error) {
      showToast('Failed to delete asset', false);
    } else {
      setAssets(prev => prev.filter(a => a.id !== asset.id));
      if (selectedAsset?.id === asset.id) setSelectedAsset(null);
      setConfirmDelete(null);
      showToast('Asset deleted');
    }
    setSaving(false);
  };

  // ── Barcode scanned ──────────────────────────────────────────────────────────
  const handleBarcodeDetect = (code: string) => {
    setShowScanner(false);
    // Check if asset with this barcode already exists
    const existing = assets.find(a => a.barcode === code);
    if (existing) { setSelectedAsset(existing); showToast(`Found: ${existing.name}`); }
    else { setForm(f => ({ ...f, barcode: code })); setShowAdd(true); showToast('New barcode — fill in details'); }
  };

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = assets.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.barcode?.includes(search) || a.location_unit.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || a.status === filterStatus;
    const matchCat = filterCategory === 'ALL' || a.category === filterCategory;
    const matchDept = filterDept === 'ALL' || a.department === filterDept;
    return matchSearch && matchStatus && matchCat && matchDept;
  });

  // Dept options visible to this user
  const deptOptions = canSeeAll
    ? [...new Set(assets.map(a => a.department))].filter(Boolean)
    : [currentUser?.department || ''];

  // Stats
  const totalActive = assets.filter(a => a.status === 'ACTIVE').length;
  const totalMaint = assets.filter(a => a.status === 'MAINTENANCE').length;
  const unitCounts = assets.reduce((acc, a) => { acc[a.location_unit] = (acc[a.location_unit] || 0) + 1; return acc; }, {} as Record<string, number>);
  const topUnit = Object.entries(unitCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  return (
    <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[600] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-black transition-all ${toast.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Scanner */}
      {showScanner && <BarcodeScanner onDetect={handleBarcodeDetect} onClose={() => setShowScanner(false)} />}

      {/* Transfer modal */}
      {transferAsset && (
        <TransferModal asset={transferAsset} units={units} onConfirm={handleTransfer} onClose={() => setTransferAsset(null)} />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Asset Management</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            {canSeeAll ? 'All Departments' : currentUser?.department} · {assets.length} assets tracked
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-xs font-black uppercase hover:opacity-90 active:scale-95 transition-all">
              <ScanLine size={15} /> Scan
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#E31E24] text-white rounded-2xl text-xs font-black uppercase hover:bg-[#C41217] active:scale-95 transition-all shadow-lg shadow-red-200 dark:shadow-red-900/30">
              <Plus size={15} /> Add Asset
            </button>
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Assets', value: assets.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Active', value: totalActive, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'In Maintenance', value: totalMaint, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Top Office', value: topUnit ? `${topUnit[0]} (${topUnit[1]})` : '—', icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} rounded-2xl flex items-center justify-center mb-3`}>
              <s.icon size={18} className={s.color} />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Main content: list + detail panel ── */}
      <div className="flex gap-5 flex-col lg:flex-row">

        {/* Left: list */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Search + filters */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input type="text" placeholder="Search name, barcode, office..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] outline-none transition-all" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { val: filterStatus, set: setFilterStatus, opts: ['ALL', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DISPOSED'] },
                { val: filterCategory, set: setFilterCategory, opts: ['ALL', ...CATEGORIES] },
              ].map((f, i) => (
                <select key={i} value={f.val} onChange={e => f.set(e.target.value)}
                  className="flex-1 min-w-[100px] px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none">
                  {f.opts.map(o => <option key={o} value={o}>{o === 'ALL' ? (i === 0 ? 'All Status' : 'All Categories') : o}</option>)}
                </select>
              ))}
              {canSeeAll && (
                <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                  className="flex-1 min-w-[100px] px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:border-[#E31E24] outline-none">
                  <option value="ALL">All Depts</option>
                  {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Asset rows */}
          <div className="divide-y divide-slate-50 dark:divide-slate-800 overflow-y-auto custom-scrollbar" style={{ maxHeight: 520 }}>
            {loading && (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#E31E24]" /></div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-16 px-6">
                <Package size={36} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                <p className="text-sm font-black text-slate-400">No assets found.</p>
                {canManage && <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Click "Add Asset" or scan a barcode.</p>}
              </div>
            )}
            {filtered.map(asset => (
              <button key={asset.id} onClick={() => setSelectedAsset(selectedAsset?.id === asset.id ? null : asset)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${selectedAsset?.id === asset.id ? 'bg-red-50 dark:bg-red-900/10 border-r-4 border-[#E31E24]' : ''}`}>
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Package size={16} className="text-slate-500 dark:text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{asset.name}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[asset.status]}`}>{asset.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                      <MapPin size={9} /> {asset.location_unit}{asset.location_detail ? ` · ${asset.location_detail}` : ''}
                    </span>
                    {asset.barcode && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Tag size={9} /> {asset.barcode}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold">×{asset.quantity}</span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase flex-shrink-0">{asset.category}</span>
                {canEditDelete && (
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openEdit(asset)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors"
                      title="Edit asset"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(asset)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                      title="Delete asset"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        {selectedAsset && (
          <div className="w-full lg:w-80 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <p className="font-black text-sm text-slate-900 dark:text-white truncate flex-1 mr-2">{selectedAsset.name}</p>
              <button onClick={() => setSelectedAsset(null)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* Info */}
              <div className="space-y-2.5">
                {[
                  { label: 'Status', value: <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedAsset.status]}`}>{selectedAsset.status}</span> },
                  { label: 'Category', value: selectedAsset.category },
                  { label: 'Department', value: selectedAsset.department },
                  { label: 'Location', value: `${selectedAsset.location_unit}${selectedAsset.location_detail ? ` · ${selectedAsset.location_detail}` : ''}` },
                  { label: 'Quantity', value: `×${selectedAsset.quantity}` },
                  ...(selectedAsset.unit_price ? [{ label: 'Unit Price', value: `৳${selectedAsset.unit_price.toLocaleString()}` }] : []),
                  ...(selectedAsset.barcode ? [{ label: 'Barcode', value: <span className="font-mono text-xs">{selectedAsset.barcode}</span> }] : []),
                  { label: 'Added By', value: selectedAsset.added_by_name },
                  { label: 'Added', value: new Date(selectedAsset.created_at).toLocaleDateString() },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex-shrink-0">{row.label}</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 text-right">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {canManage && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {canEditDelete && (
                    <button onClick={() => openEdit(selectedAsset)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-black text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95">
                      <Edit2 size={14} /> Edit Asset Details
                    </button>
                  )}
                  <button onClick={() => setTransferAsset(selectedAsset)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95">
                    <ArrowRightLeft size={14} className="text-blue-500" /> Transfer to another office
                  </button>
                  {selectedAsset.status !== 'MAINTENANCE' && (
                    <button onClick={() => handleStatusChange(selectedAsset, 'MAINTENANCE')}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-black text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-95">
                      <AlertCircle size={14} /> Mark as Maintenance
                    </button>
                  )}
                  {selectedAsset.status === 'MAINTENANCE' && (
                    <button onClick={() => handleStatusChange(selectedAsset, 'ACTIVE')}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95">
                      <CheckCircle size={14} /> Mark as Active
                    </button>
                  )}
                  {canManage && selectedAsset.status !== 'DISPOSED' && (
                    <button onClick={() => handleStatusChange(selectedAsset, 'DISPOSED')}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                      <Trash2 size={14} /> Dispose Asset
                    </button>
                  )}
                  {canEditDelete && (
                    <button onClick={() => setConfirmDelete(selectedAsset)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-2xl text-xs font-black text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all active:scale-95 border border-red-200 dark:border-red-900/40">
                      <Trash2 size={14} /> Delete Asset Permanently
                    </button>
                  )}
                </div>
              )}

              {/* Audit log */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">History</p>
                {logs.length === 0 && <p className="text-xs text-slate-400">No history yet.</p>}
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-2.5 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#E31E24] mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          {log.action === 'TRANSFERRED' ? `Transferred → ${log.to_location}` : log.action}
                        </p>
                        {log.note && <p className="text-[10px] text-slate-400 truncate">{log.note}</p>}
                        <p className="text-[10px] text-slate-400">{log.done_by_name} · {new Date(log.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-black text-sm text-slate-900 dark:text-white">Delete Asset?</p>
                <p className="text-[10px] text-slate-400 font-bold">This cannot be undone.</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <p className="text-sm font-black text-slate-900 dark:text-white">{confirmDelete.name}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{confirmDelete.category} · {confirmDelete.location_unit}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  disabled={saving}
                  className="flex-[2] py-3 text-xs font-black uppercase text-white bg-red-600 rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Asset Modal ── */}
      {editAsset && (
        <div className="fixed inset-0 z-[450] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-blue-500" />
                <span className="font-black text-sm text-slate-900 dark:text-white">Edit Asset</span>
              </div>
              <button onClick={() => setEditAsset(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
              <div className="flex gap-2 items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <Tag size={14} className="text-slate-400 flex-shrink-0" />
                <input type="text" placeholder="Barcode (optional)"
                  value={editForm.barcode as string || ''}
                  onChange={e => setEditForm(f => ({ ...f, barcode: e.target.value }))}
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none font-mono" />
              </div>

              {([
                { label: 'Asset Name *', key: 'name', placeholder: 'e.g. Dell Laptop X1' },
                { label: 'Description', key: 'description', placeholder: 'Optional details...' },
                { label: 'Room / Floor', key: 'location_detail', placeholder: 'e.g. Room 3, Floor 2' },
              ] as { label: string; key: keyof typeof editForm; placeholder: string }[]).map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{f.label}</label>
                  <input type="text" placeholder={f.placeholder}
                    value={(editForm[f.key] as string) || ''}
                    onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] outline-none" />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Category *</label>
                  <select value={editForm.category || 'Electronics'}
                    onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Status</label>
                  <select value={editForm.status || 'ACTIVE'}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Asset['status'] }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                    {['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DISPOSED'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Quantity *</label>
                  <input type="number" min={1} value={editForm.quantity || 1}
                    onChange={e => setEditForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Unit Price (৳)</label>
                  <input type="number" placeholder="0.00"
                    value={editForm.unit_price !== undefined && editForm.unit_price !== null ? editForm.unit_price : ''}
                    onChange={e => setEditForm(f => ({ ...f, unit_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Office / Unit *</label>
                <select value={editForm.location_unit || ''}
                  onChange={e => setEditForm(f => ({ ...f, location_unit: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                  <option value="">Select office...</option>
                  {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  <option value="Head Office">Head Office</option>
                  <option value="Remote">Remote / Off-site</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Department *</label>
                <select value={editForm.department || ''}
                  onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                  <option value="">Select department...</option>
                  {['Marketing', 'Inventory', 'IT', 'Finance', 'HR', 'Operations', 'Admin'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditAsset(null)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">Cancel</button>
                <button onClick={handleEdit}
                  disabled={saving || !editForm.name?.trim() || !editForm.location_unit || !editForm.department}
                  className="flex-[2] py-3 text-xs font-black uppercase text-white bg-blue-600 rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Asset Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-[#E31E24]" />
                <span className="font-black text-sm text-slate-900 dark:text-white">Add New Asset</span>
              </div>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '70vh' }}>
              {/* Barcode */}
              <div className="flex gap-2 items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <Tag size={14} className="text-slate-400 flex-shrink-0" />
                <input type="text" placeholder="Barcode (optional)" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none font-mono" />
                <button onClick={() => setShowScanner(true)} className="flex-shrink-0 p-1.5 text-[#E31E24]"><ScanLine size={16} /></button>
              </div>

              {[
                { label: 'Asset Name *', key: 'name', placeholder: 'e.g. Dell Laptop X1' },
                { label: 'Description', key: 'description', placeholder: 'Optional details...' },
                { label: 'Room / Floor', key: 'location_detail', placeholder: 'e.g. Room 3, Floor 2' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-[#E31E24] outline-none" />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Category *</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Asset['status'] }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                    {['ACTIVE','INACTIVE','MAINTENANCE'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Quantity *</label>
                  <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Unit Price (৳)</label>
                  <input type="number" placeholder="0.00" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Office / Unit *</label>
                <select value={form.location_unit} onChange={e => setForm(f => ({ ...f, location_unit: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                  <option value="">Select office...</option>
                  {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  <option value="Head Office">Head Office</option>
                  <option value="Remote">Remote / Off-site</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Department *</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-[#E31E24] outline-none">
                  <option value="">Select department...</option>
                  {canSeeAll
                    ? ['Marketing', 'Inventory', 'IT', 'Finance', 'HR', 'Operations', 'Admin'].map(d => <option key={d} value={d}>{d}</option>)
                    : <option value={currentUser?.department}>{currentUser?.department}</option>
                  }
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-xs font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-2xl">Cancel</button>
                <button onClick={handleAdd} disabled={saving || !form.name.trim() || !form.location_unit || !form.department}
                  className="flex-[2] py-3 text-xs font-black uppercase text-white bg-[#E31E24] rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Save Asset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetView;
