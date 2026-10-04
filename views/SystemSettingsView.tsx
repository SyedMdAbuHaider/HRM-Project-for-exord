/**
 * SystemSettingsView.tsx
 * Manage allowed IP subnets and CORS origins from the admin UI.
 * Accessible by DEVELOPER and ADMIN only.
 * Settings are stored in the server-owned HRM database.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useHRM } from '../store';
import { UserRole } from '../types';
import { api } from '../apiClient';
import {
  Settings, Globe, Network, Plus, Trash2, Save,
  Shield, RefreshCw, CheckCircle, AlertCircle,
  Lock, Loader2, Info, X, Mail, Eye, EyeOff
} from 'lucide-react';

const inputCls = "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] outline-none transition-all font-mono";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5";

interface SystemSetting {
  key: string;
  value: any;
  updated_by: string;
  updated_at: string;
}

const SystemSettingsView: React.FC = () => {
  const { currentUser, addActivityLog } = useHRM();

  const isDev   = currentUser?.role === UserRole.DEVELOPER;
  const canEdit = isDev; // Developer only

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null);

  // IP subnets (e.g. "192.168.1", "10.0.0")
  const [ipSubnets, setIpSubnets]   = useState<string[]>(['192.168.1']);
  const [newSubnet, setNewSubnet]   = useState('');

  // Allowed CORS origins (e.g. "https://admin.exord.net")
  const [origins, setOrigins]       = useState<string[]>([]);
  const [newOrigin, setNewOrigin]   = useState('');

  // SMTP settings
  const [smtpHost, setSmtpHost]       = useState('');
  const [smtpPort, setSmtpPort]       = useState('587');
  const [smtpUser, setSmtpUser]       = useState('');
  const [smtpPass, setSmtpPass]       = useState('');
  const [smtpFrom, setSmtpFrom]       = useState('');
  const [smtpFromName, setSmtpFromName] = useState('Exord Online HRM');
  const [smtpSecure, setSmtpSecure]   = useState<'tls' | 'ssl' | 'none'>('tls');
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{settings: SystemSetting[]}>('/api/v1/system-settings?keys=allowed_ip_subnets,allowed_origins,smtp_config');
      (result.settings || []).forEach((row: any) => {
        const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (row.key === 'allowed_ip_subnets') setIpSubnets(Array.isArray(parsed) ? parsed : []);
        if (row.key === 'allowed_origins') setOrigins(Array.isArray(parsed) ? parsed : []);
        if (row.key === 'smtp_config') {
          if (parsed?.host) setSmtpHost(parsed.host);
          if (parsed?.port) setSmtpPort(String(parsed.port));
          if (parsed?.user) setSmtpUser(parsed.user);
          if (parsed?.pass) setSmtpPass(parsed.pass);
          if (parsed?.from) setSmtpFrom(parsed.from);
          if (parsed?.fromName) setSmtpFromName(parsed.fromName);
          if (parsed?.secure) setSmtpSecure(parsed.secure);
        }
      });
    } catch (e) { console.error('[SystemSettings] load failed', e); }
    finally { setLoading(false); }
  }, []);
  const handleSaveSection = async (key: string, value: any, label: string) => {
    if (!canEdit) return;
    setSaving(true);
    const result = await saveSetting(key, value);
    if (result.ok) {
      showToast(true, `${label} saved successfully.`);
    } else {
      showToast(false, `Failed to save ${label}: ${result.error || 'unknown error'}`);
    }
    setSaving(false);
  };

  const handleSaveAll = async () => {
    if (!canEdit) return;
    setSaving(true);

    const smtpConfig = {
      host: smtpHost, port: smtpPort, user: smtpUser,
      pass: smtpPass, from: smtpFrom, fromName: smtpFromName, secure: smtpSecure,
    };

    const tasks = [
      { key: 'allowed_ip_subnets', value: ipSubnets,  label: 'IP Subnets'    },
      { key: 'allowed_origins',    value: origins,     label: 'CORS Origins'  },
      { key: 'smtp_config',        value: smtpConfig,  label: 'SMTP Config'   },
    ];

    const errors: string[] = [];
    for (const task of tasks) {
      const result = await saveSetting(task.key, task.value);
      if (!result.ok) {
        errors.push(`${task.label}: ${result.error || 'unknown error'}`);
      }
    }

    if (errors.length === 0) {
      await addActivityLog(
        'SETTINGS_UPDATE', 'SYSTEM',
        `System settings updated by ${currentUser?.name}. IP subnets: ${ipSubnets.length}, Origins: ${origins.length}, SMTP: ${smtpHost || 'not configured'}.`,
        'MEDIUM'
      );
      showToast(true, 'All settings saved. Restart file server for CORS changes to take effect.');
    } else {
      showToast(false, `Save failed — ${errors.join(' | ')}`);
    }
    setSaving(false);
  };

  // Save only CORS origins (standalone button to avoid state race conditions)
  const handleSaveOrigins = async () => {
    if (!canEdit) return;
    setSaving(true);
    const result = await saveSetting('allowed_origins', origins);
    if (result.ok) {
      showToast(true, `${origins.length} CORS origin(s) saved. Restart file server to apply.`);
    } else {
      showToast(false, `Failed to save CORS origins — ${result.error}`);
    }
    setSaving(false);
  };

  const addSubnet = () => {
    const s = newSubnet.trim();
    if (!s) return;
    // Basic format check: e.g. "192.168.1" or "10.0.0"
    if (ipSubnets.includes(s)) { showToast(false, 'Already in list.'); return; }
    setIpSubnets(prev => [...prev, s]);
    setNewSubnet('');
  };

  const removeSubnet = (s: string) => setIpSubnets(prev => prev.filter(x => x !== s));

  const addOrigin = () => {
    const o = newOrigin.trim();
    if (!o) return;
    if (!o.startsWith('http://') && !o.startsWith('https://')) { showToast(false, 'Must start with http:// or https://'); return; }
    if (origins.includes(o)) { showToast(false, 'Already in list.'); return; }
    setOrigins(prev => [...prev, o]);
    setNewOrigin('');
  };

  const removeOrigin = (o: string) => setOrigins(prev => prev.filter(x => x !== o));

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center">
          <Lock size={24} className="text-[#E31E24]" />
        </div>
        <p className="text-slate-400 font-bold">Access restricted to Admin and Developer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">System Settings</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Manage network access, IP whitelists and allowed domains.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadSettings} disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-[#E31E24] transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
          </button>
          <button onClick={handleSaveAll} disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-sm font-bold ${
          toast.ok
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/30'
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/30'
        }`}>
          {toast.ok ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#E31E24]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

          {/* ── IP Subnet Whitelist ── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                <Network size={18} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">Allowed IP Subnets</h3>
                <p className="text-[10px] text-slate-400 font-bold">Employees must be on one of these networks to check in</p>
              </div>
              <button
                onClick={() => handleSaveSection('allowed_ip_subnets', ipSubnets, 'IP Subnets')}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                <Save size={12} /> Save
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl flex items-start gap-3 border border-blue-100 dark:border-blue-900/30">
                <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 dark:text-blue-400 font-bold leading-relaxed">
                  Enter the subnet prefix only — e.g. <span className="font-mono bg-blue-100 dark:bg-blue-900/30 px-1 rounded">192.168.1</span> matches any IP starting with 192.168.1.x. ADMIN, CO_ADMIN, and DEVELOPER are exempt from this check.
                </p>
              </div>

              {/* Current subnets */}
              <div className="space-y-2">
                {ipSubnets.map(s => (
                  <div key={s} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <Shield size={14} className="text-blue-500 flex-shrink-0" />
                    <span className="flex-1 font-mono text-sm text-slate-900 dark:text-white font-bold">{s}.*</span>
                    <button onClick={() => removeSubnet(s)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {ipSubnets.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold text-center py-3">
                    ⚠ No subnets — all IPs blocked for check-in
                  </p>
                )}
              </div>

              {/* Add subnet */}
              <div className="flex gap-2">
                <input type="text" value={newSubnet} onChange={e => setNewSubnet(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubnet()}
                  placeholder="e.g. 192.168.1" className={inputCls + " flex-1"} />
                <button onClick={addSubnet} disabled={!newSubnet.trim()}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase disabled:opacity-50 active:scale-95 transition-all">
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Allowed Origins (CORS) ── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                <Globe size={18} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 dark:text-white text-sm">Allowed Domains / Origins</h3>
                <p className="text-[10px] text-slate-400 font-bold">CORS whitelist for the file server</p>
              </div>
              <button
                onClick={() => handleSaveSection('allowed_origins', origins, 'CORS Origins')}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                <Save size={12} /> Save
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl flex items-start gap-3 border border-emerald-100 dark:border-emerald-900/30">
                <Info size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-relaxed">
                  These domains are allowed to make requests to the file server. Include protocol — e.g. <span className="font-mono bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">https://admin.exord.net</span>. After saving, restart the file server with <span className="font-mono">pm2 restart exord-file-server</span>.
                  <br /><br />
                  If saving fails, run this SQL in Supabase once: <span className="font-mono bg-emerald-100 dark:bg-emerald-900/30 px-1 rounded">ALTER TABLE system_settings ADD CONSTRAINT system_settings_key_unique UNIQUE (key);</span>
                </p>
              </div>

              {/* Current origins */}
              <div className="space-y-2">
                {origins.map(o => (
                  <div key={o} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <Globe size={14} className="text-emerald-500 flex-shrink-0" />
                    <span className="flex-1 font-mono text-xs text-slate-900 dark:text-white font-bold truncate">{o}</span>
                    <button onClick={() => removeOrigin(o)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {origins.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-3">No custom origins configured.</p>
                )}
              </div>

              {/* Add origin */}
              <div className="flex gap-2">
                <input type="text" value={newOrigin} onChange={e => setNewOrigin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addOrigin()}
                  placeholder="https://yourdomain.com" className={inputCls + " flex-1"} />
                <button onClick={addOrigin} disabled={!newOrigin.trim()}
                  className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase disabled:opacity-50 active:scale-95 transition-all">
                  <Plus size={15} />
                </button>
              </div>

              {/* Dedicated save button for origins — avoids race condition */}
              <button
                onClick={handleSaveOrigins}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/20"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Origins ({origins.length})
              </button>
            </div>
          </div>

          {/* ── SMTP / Email Configuration ── */}
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-50 dark:bg-violet-900/20 rounded-2xl flex items-center justify-center">
                <Mail size={18} className="text-violet-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">Email / SMTP Configuration</h3>
                <p className="text-[10px] text-slate-400 font-bold">Used for sending broadcast emails to employees</p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-2xl flex items-start gap-3 border border-violet-100 dark:border-violet-900/30">
                <Info size={14} className="text-violet-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-violet-700 dark:text-violet-400 font-bold leading-relaxed">
                  Configure your SMTP server here. Credentials are stored encrypted in Supabase. For Gmail, use App Password (not your account password) and host <span className="font-mono bg-violet-100 dark:bg-violet-900/30 px-1 rounded">smtp.gmail.com</span> port <span className="font-mono bg-violet-100 dark:bg-violet-900/30 px-1 rounded">587</span> with TLS.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className={labelCls}>SMTP Host</label>
                    <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Port</label>
                    <input type="text" value={smtpPort} onChange={e => setSmtpPort(e.target.value)}
                      placeholder="587" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>SMTP Username</label>
                  <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
                    placeholder="your@email.com" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>SMTP Password / App Password</label>
                  <div className="relative">
                    <input
                      type={showSmtpPass ? 'text' : 'password'}
                      value={smtpPass} onChange={e => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••" className={inputCls + " pr-11"} />
                    <button type="button" onClick={() => setShowSmtpPass(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>From Email Address</label>
                  <input type="email" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)}
                    placeholder="hrm@exordonline.com" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>From Display Name</label>
                  <input type="text" value={smtpFromName} onChange={e => setSmtpFromName(e.target.value)}
                    placeholder="Exord Online HRM" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Encryption</label>
                  <div className="flex gap-2">
                    {(['tls', 'ssl', 'none'] as const).map(opt => (
                      <button key={opt} type="button" onClick={() => setSmtpSecure(opt)}
                        className={`flex-1 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-widest transition-all ${
                          smtpSecure === opt
                            ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10 text-[#E31E24]'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                        }`}>
                        {opt === 'tls' ? 'STARTTLS' : opt === 'ssl' ? 'SSL/TLS' : 'None'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-end">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Common Presets</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Gmail',   host: 'smtp.gmail.com',      port: '587', secure: 'tls' as const },
                        { label: 'Outlook', host: 'smtp.office365.com',   port: '587', secure: 'tls' as const },
                        { label: 'Yahoo',   host: 'smtp.mail.yahoo.com',  port: '587', secure: 'tls' as const },
                        { label: 'Custom',  host: '',                     port: '587', secure: 'tls' as const },
                      ].map(p => (
                        <button key={p.label} type="button"
                          onClick={() => { setSmtpHost(p.host); setSmtpPort(p.port); setSmtpSecure(p.secure); }}
                          className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-300 hover:border-[#E31E24] hover:text-[#E31E24] transition-all active:scale-95">
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {smtpHost && smtpUser && smtpPass && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                    SMTP configured: {smtpUser} via {smtpHost}:{smtpPort} ({smtpSecure.toUpperCase()})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Info panel ── */}
          <div className="xl:col-span-2 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-4">
              <Info size={14} className="text-slate-400" /> How settings are applied
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <div className="space-y-1">
                <p className="font-black text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-widest">IP Subnets</p>
                <p>Stored in Supabase. The frontend reads them on next check-in attempt. No server restart needed.</p>
              </div>
              <div className="space-y-1">
                <p className="font-black text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-widest">CORS Origins</p>
                <p>Stored in Supabase. The file server reads them on startup. Restart <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">exord-file-server</code> after saving.</p>
              </div>
              <div className="space-y-1">
                <p className="font-black text-slate-700 dark:text-slate-300 text-[10px] uppercase tracking-widest">SMTP / Email</p>
                <p>Credentials stored in Supabase. Used by the broadcast system to send emails. Never logged or displayed in audit trail.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettingsView;
