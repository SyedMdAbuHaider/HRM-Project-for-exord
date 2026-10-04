import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useHRM } from '../store';
import {
  Building2, MapPin, Plus, Save, X, Edit2, Trash2,
  Globe, Shield, Hash, AlertTriangle, Radio, Wifi, Network,
  ChevronDown, ChevronUp, Lock, Activity, RefreshCw,
  CheckCircle, XCircle, Clock, Signal, Loader2,
  Cpu, HardDrive, Thermometer, Zap, Server, Info,
  Database, BarChart3, Layers, Router, UserCheck, Search,
} from 'lucide-react';
import { Unit, Department, UnitType, DeviceType, SnmpConfig, UserRole } from '../types';

// ─── Defined OUTSIDE component to prevent remount-on-keystroke ───────────────

const inputCls = "w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-[#E31E24] transition-all";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5";

// ── POP probe status types ────────────────────────────────────────────────────
type ProbeStatus = 'unknown' | 'checking' | 'up' | 'down' | 'error';

interface PopProbeResult {
  ping: { status: ProbeStatus; latencyMs?: number; error?: string; checkedAt?: string; };
  snmp: { status: ProbeStatus; uptime?: string; sysDescr?: string; error?: string; checkedAt?: string; };
}

// ── SNMP detail result types ──────────────────────────────────────────────────
interface SnmpDetailResult {
  status: 'up' | 'down' | 'error';
  error?: string;
  checkedAt?: string;
  system?: {
    uptime: string | null;
    uptimeSeconds: number | null;
    sysDescr: string | null;
    sysName: string | null;
    sysLocation: string | null;
    sysContact: string | null;
  };
  performance?: {
    cpuPercent: number | null;
    ramUsedBytes: number | null;
    ramTotalBytes: number | null;
    hddUsedBytes: number | null;
    hddTotalBytes: number | null;
    temperatureCelsius: number | null;
    voltageDecivolts: number | null;
  };
  mikrotik?: { board: string | null; firmwareVersion: string | null; } | null;
  interfaces: Array<{
    index: number;
    name: string;
    operStatus: 'up' | 'down' | 'unknown';
    adminStatus: 'up' | 'down' | 'unknown';
    speedBps: number | null;
    inOctets: number | null;
    outOctets: number | null;
    inErrors: number | null;
    outErrors: number | null;
  }>;
}

// ── Detail helper utilities ───────────────────────────────────────────────────
const fmtBytes = (bytes: number | null): string => {
  if (bytes == null || bytes < 0) return 'N/A';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const fmtSpeed = (bps: number | null): string => {
  if (bps == null) return 'N/A';
  if (bps === 0) return '0 bps';
  if (bps < 1_000) return `${bps} bps`;
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(0)} Kbps`;
  if (bps < 1_000_000_000) return `${(bps / 1_000_000).toFixed(0)} Mbps`;
  return `${(bps / 1_000_000_000).toFixed(1)} Gbps`;
};

const usagePct = (used: number | null, total: number | null): number | null => {
  if (used == null || total == null || total === 0) return null;
  return Math.min(100, Math.round((used / total) * 100));
};

const defaultProbeResult = (): PopProbeResult => ({
  ping: { status: 'unknown' },
  snmp: { status: 'unknown' },
});

// ── Probe API calls ───────────────────────────────────────────────────────────
const probePing = async (host: string): Promise<PopProbeResult['ping']> => {
  try {
    const res = await fetch('/api/v1/probe/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host }),
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {
      return {
        status: 'down',
        error: res.ok ? 'Probe server returned non-JSON response' : `HTTP ${res.status}`,
        checkedAt: new Date().toISOString(),
      };
    }
    if (!res.ok) return { status: 'down', error: data.error || `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
    return { status: data.status === 'up' ? 'up' : 'down', latencyMs: data.latencyMs, error: data.error, checkedAt: new Date().toISOString() };
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') return { status: 'down', error: 'Request timed out (10s)', checkedAt: new Date().toISOString() };
    return { status: 'error', error: e.message || 'Network error', checkedAt: new Date().toISOString() };
  }
};

const probeSnmp = async (config: SnmpConfig): Promise<PopProbeResult['snmp']> => {
  try {
    const res = await fetch('/api/v1/probe/snmp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: config.host, community: config.community, port: config.port || 161, oid: config.oid || '1.3.6.1.2.1.1.3.0' }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {
      return { status: 'down', error: res.ok ? 'Probe server returned non-JSON response' : `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
    }
    if (!res.ok) return { status: 'down', error: data.error || `HTTP ${res.status}`, checkedAt: new Date().toISOString() };
    return { status: data.status === 'up' ? 'up' : 'down', uptime: data.uptime, sysDescr: data.sysDescr, error: data.error, checkedAt: new Date().toISOString() };
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') return { status: 'down', error: 'Request timed out (15s)', checkedAt: new Date().toISOString() };
    return { status: 'error', error: e.message || 'Network error', checkedAt: new Date().toISOString() };
  }
};

const probeUnit = async (unit: Unit): Promise<PopProbeResult> => {
  if (!unit.snmpConfig?.host) return defaultProbeResult();
  const [ping, snmp] = await Promise.all([probePing(unit.snmpConfig.host), probeSnmp(unit.snmpConfig)]);
  return { ping, snmp };
};

const probeSnmpDetail = async (config: SnmpConfig): Promise<SnmpDetailResult> => {
  try {
    const res = await fetch('/api/v1/probe/snmp/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: config.host, community: config.community, port: config.port || 161 }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { return { status: 'down', error: 'Non-JSON response from probe server', interfaces: [] }; }
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError')
      return { status: 'down', error: 'Detail probe timed out (25s)', interfaces: [] };
    return { status: 'error', error: e.message || 'Network error', interfaces: [] };
  }
};

// ── Status badge component ────────────────────────────────────────────────────
const StatusPill: React.FC<{ label: string; status: ProbeStatus; detail?: string; icon: React.ElementType; }> = ({ label, status, detail, icon: Icon }) => {
  const cfg: Record<ProbeStatus, { bg: string; text: string; dot: string }> = {
    unknown:  { bg: 'bg-slate-100 dark:bg-slate-800',       text: 'text-slate-500',                        dot: 'bg-slate-400' },
    checking: { bg: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-600 dark:text-blue-400',      dot: 'bg-blue-400 animate-pulse' },
    up:       { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400',dot: 'bg-emerald-500' },
    down:     { bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-600 dark:text-red-400',        dot: 'bg-red-500' },
    error:    { bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-400',    dot: 'bg-amber-500' },
  };
  const c = cfg[status];
  const label2 = status === 'checking' ? '…' : status === 'unknown' ? '—' : status.toUpperCase();
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${c.bg} ${status === 'up' ? 'border-emerald-200 dark:border-emerald-900/40' : status === 'down' ? 'border-red-200 dark:border-red-900/40' : 'border-transparent'}`} title={detail || ''}>
      <Icon size={11} className={c.text} />
      <span className={`text-[9px] font-black uppercase tracking-widest ${c.text}`}>{label}</span>
      <div className="flex items-center gap-1 ml-auto">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
        <span className={`text-[9px] font-black ${c.text}`}>{label2}</span>
      </div>
    </div>
  );
};

// ── UsageBar — for CPU, RAM, HDD gauges in the detail modal ──────────────────
const UsageBar: React.FC<{ pct: number | null; label: string; used: string; total: string; warn?: number; crit?: number }> = ({
  pct, label, used, total, warn = 70, crit = 90,
}) => {
  const color = pct == null ? 'bg-slate-300' : pct >= crit ? 'bg-red-500' : pct >= warn ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-xs font-black text-slate-900 dark:text-white">
          {pct != null ? `${pct}%` : 'N/A'}
          {total !== 'N/A' && <span className="text-[9px] font-medium text-slate-400 ml-1">({used} / {total})</span>}
        </span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
};

// ── Device type config ────────────────────────────────────────────────────────
const DEVICE_TYPES: { value: DeviceType; label: string; emoji: string; desc: string }[] = [
  { value: 'router', label: 'Router',       emoji: '🔀', desc: 'Layer 3 routing'    },
  { value: 'switch', label: 'Switch',       emoji: '🔌', desc: 'Layer 2 switching'  },
  { value: 'ap',     label: 'Access Point', emoji: '📶', desc: 'Wireless AP'        },
  { value: 'olt',    label: 'OLT',          emoji: '💡', desc: 'Optical line term'  },
  { value: 'server', label: 'Server',       emoji: '🖥️', desc: 'Compute / storage'  },
  { value: 'other',  label: 'Other',        emoji: '⚙️', desc: 'Custom device'      },
];

const DEVICE_TYPE_BADGE: Record<DeviceType, { bg: string; text: string }> = {
  router: { bg: 'bg-blue-100 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-400'    },
  switch: { bg: 'bg-teal-100 dark:bg-teal-900/20',     text: 'text-teal-700 dark:text-teal-400'    },
  ap:     { bg: 'bg-violet-100 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-400' },
  olt:    { bg: 'bg-amber-100 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-400'  },
  server: { bg: 'bg-slate-100 dark:bg-slate-800',      text: 'text-slate-600 dark:text-slate-400'  },
  other:  { bg: 'bg-slate-100 dark:bg-slate-800',      text: 'text-slate-500 dark:text-slate-400'  },
};

// ── DeviceTypePicker ──────────────────────────────────────────────────────────
const DeviceTypePicker: React.FC<{ value: DeviceType; onChange: (v: DeviceType) => void }> = ({ value, onChange }) => (
  <div>
    <label className={labelCls}>Device Type <span className="text-red-400">*</span></label>
    <div className="grid grid-cols-3 gap-2">
      {DEVICE_TYPES.map(opt => {
        const isActive = value === opt.value;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center ${isActive ? 'border-[#E31E24] bg-[#E31E24]/5 dark:bg-[#E31E24]/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
            <span className="text-lg leading-none">{opt.emoji}</span>
            <span className={`text-[10px] font-black uppercase tracking-wider leading-tight ${isActive ? 'text-[#E31E24]' : 'text-slate-500 dark:text-slate-400'}`}>{opt.label}</span>
            <span className="text-[8px] text-slate-400 leading-tight">{opt.desc}</span>
          </button>
        );
      })}
    </div>
  </div>
);

// ── DeviceDetailModal ─────────────────────────────────────────────────────────
type DetailTab = 'system' | 'performance' | 'interfaces';

const DeviceDetailModal: React.FC<{ unit: Unit; onClose: () => void }> = ({ unit, onClose }) => {
  const [tab, setTab]         = useState<DetailTab>('system');
  const [loading, setLoading] = useState(true);
  const [result, setResult]   = useState<SnmpDetailResult | null>(null);
  const mountedRef             = useRef(true);

  const fetchDetail = useCallback(async () => {
    if (!unit.snmpConfig) return;
    setLoading(true);
    const r = await probeSnmpDetail(unit.snmpConfig);
    if (mountedRef.current) { setResult(r); setLoading(false); }
  }, [unit]);

  useEffect(() => {
    mountedRef.current = true;
    fetchDetail();
    return () => { mountedRef.current = false; };
  }, [fetchDetail]);

  const devType   = unit.deviceType || 'router';
  const devCfg    = DEVICE_TYPE_BADGE[devType];
  const devLabel  = DEVICE_TYPES.find(d => d.value === devType);
  const s         = result?.system;
  const p         = result?.performance;
  const mt        = result?.mikrotik;
  const ifaces    = result?.interfaces || [];

  // Temperature color
  const tempColor = (t: number | null) => {
    if (t == null) return 'text-slate-400';
    if (t >= 70) return 'text-red-600 dark:text-red-400';
    if (t >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const tabs: { id: DetailTab; label: string; icon: React.ElementType }[] = [
    { id: 'system',      label: 'System',      icon: Server     },
    { id: 'performance', label: 'Performance', icon: BarChart3  },
    { id: 'interfaces',  label: `Interfaces${ifaces.length ? ` (${ifaces.length})` : ''}`, icon: Layers },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <Radio size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{unit.name}</h3>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${devCfg.bg} ${devCfg.text}`}>
                  {devLabel?.emoji} {devLabel?.label || devType}
                </span>
                {mt?.board && (
                  <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 rounded-lg text-[9px] font-black uppercase tracking-widest">
                    MikroTik
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {unit.snmpConfig?.host}:{unit.snmpConfig?.port || 161}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={fetchDetail}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-[#E31E24] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-3 gap-1 flex-shrink-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-[#E31E24] text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={32} className="text-[#E31E24] animate-spin" />
              <p className="text-sm font-bold text-slate-400">Polling device via SNMP…</p>
            </div>
          )}

          {/* Error */}
          {!loading && result?.status !== 'up' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl">
                <XCircle size={28} className="text-red-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-black text-slate-900 dark:text-white">Unable to fetch device details</p>
                <p className="text-xs text-red-500 font-medium max-w-xs">{result?.error || 'Unknown error'}</p>
              </div>
            </div>
          )}

          {/* ── System Tab ── */}
          {!loading && result?.status === 'up' && tab === 'system' && (
            <div className="space-y-4">
              {/* MikroTik identity */}
              {mt && (mt.board || mt.firmwareVersion) && (
                <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-900/30 rounded-2xl p-5 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-2">MikroTik Device</p>
                  {mt.board && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 w-28 uppercase tracking-widest flex-shrink-0">Board</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">{mt.board}</span>
                    </div>
                  )}
                  {mt.firmwareVersion && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 w-28 uppercase tracking-widest flex-shrink-0">RouterOS</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">{mt.firmwareVersion}</span>
                    </div>
                  )}
                </div>
              )}

              {/* System info rows */}
              <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
                {[
                  { label: 'System Name',  value: s?.sysName,     icon: Server     },
                  { label: 'Uptime',       value: s?.uptime,      icon: Clock      },
                  { label: 'Location',     value: s?.sysLocation, icon: MapPin     },
                  { label: 'Contact',      value: s?.sysContact,  icon: Hash       },
                  { label: 'Description',  value: s?.sysDescr,    icon: Info       },
                ].map((row, i, arr) => (
                  <div key={row.label} className={`flex items-start gap-3 px-5 py-4 ${i < arr.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}>
                    <row.icon size={13} className="text-[#E31E24] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{row.label}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white break-all leading-snug">
                        {row.value || <span className="text-slate-300 dark:text-slate-600 italic font-medium">N/A</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Connection info */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Connection</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Host</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{unit.snmpConfig?.host}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Port</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{unit.snmpConfig?.port || 161}</p>
                  </div>
                </div>
              </div>

              {/* Last checked */}
              {result.checkedAt && (
                <p className="text-[10px] text-slate-400 font-medium text-center">
                  Last polled: {new Date(result.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
          )}

          {/* ── Performance Tab ── */}
          {!loading && result?.status === 'up' && tab === 'performance' && (
            <div className="space-y-5">
              {/* CPU + Temp + Voltage row */}
              <div className="grid grid-cols-3 gap-3">
                {/* CPU */}
                <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-center">
                  <Cpu size={16} className="text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {p?.cpuPercent != null ? `${p.cpuPercent}%` : 'N/A'}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">CPU Load</p>
                </div>
                {/* Temperature */}
                <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-center">
                  <Thermometer size={16} className={`mx-auto mb-2 ${tempColor(p?.temperatureCelsius ?? null)}`} />
                  <p className={`text-2xl font-black ${tempColor(p?.temperatureCelsius ?? null)}`}>
                    {p?.temperatureCelsius != null ? `${p.temperatureCelsius}°C` : 'N/A'}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Temperature</p>
                </div>
                {/* Voltage */}
                <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-center">
                  <Zap size={16} className="text-amber-500 mx-auto mb-2" />
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {p?.voltageDecivolts != null ? `${(p.voltageDecivolts / 10).toFixed(1)}V` : 'N/A'}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Voltage</p>
                </div>
              </div>

              {/* RAM bar */}
              <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 space-y-4">
                <UsageBar
                  label="RAM"
                  pct={usagePct(p?.ramUsedBytes ?? null, p?.ramTotalBytes ?? null)}
                  used={fmtBytes(p?.ramUsedBytes ?? null)}
                  total={fmtBytes(p?.ramTotalBytes ?? null)}
                  warn={75} crit={90}
                />
                <UsageBar
                  label="Storage / Flash"
                  pct={usagePct(p?.hddUsedBytes ?? null, p?.hddTotalBytes ?? null)}
                  used={fmtBytes(p?.hddUsedBytes ?? null)}
                  total={fmtBytes(p?.hddTotalBytes ?? null)}
                  warn={70} crit={85}
                />
                {p?.cpuPercent != null && (
                  <UsageBar
                    label="CPU"
                    pct={p.cpuPercent}
                    used={`${p.cpuPercent}%`}
                    total="N/A"
                    warn={70} crit={90}
                  />
                )}
              </div>

              {/* All-N/A notice */}
              {p?.cpuPercent == null && p?.ramTotalBytes == null && p?.hddTotalBytes == null && p?.temperatureCelsius == null && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    ⚠ Performance OIDs returned no data. This device may not support HOST-RESOURCES-MIB or MikroTik gauge OIDs.
                    Try checking the device's SNMP MIB documentation for the correct OIDs.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Interfaces Tab ── */}
          {!loading && result?.status === 'up' && tab === 'interfaces' && (
            <div className="space-y-4">
              {ifaces.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center">
                  <p className="text-sm text-slate-400 font-medium">No interfaces found in indices 1–12.</p>
                  <p className="text-xs text-slate-400 mt-1">The device may use higher interface indices.</p>
                </div>
              ) : (
                <>
                  {/* Summary pills */}
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest">
                      ✓ {ifaces.filter(i => i.operStatus === 'up').length} UP
                    </span>
                    <span className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest">
                      ✗ {ifaces.filter(i => i.operStatus === 'down').length} DOWN
                    </span>
                    <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">
                      {ifaces.length} total
                    </span>
                  </div>

                  {/* Interface cards */}
                  <div className="space-y-3">
                    {ifaces.map(iface => {
                      const isUp    = iface.operStatus === 'up';
                      const isDown  = iface.operStatus === 'down';
                      const hasErrs = (iface.inErrors ?? 0) > 0 || (iface.outErrors ?? 0) > 0;
                      return (
                        <div key={iface.index} className={`rounded-2xl border-2 overflow-hidden transition-all ${isUp ? 'border-emerald-200 dark:border-emerald-900/40' : isDown ? 'border-red-200 dark:border-red-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                          {/* Interface header */}
                          <div className={`flex items-center justify-between px-4 py-3 ${isUp ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : isDown ? 'bg-red-50/40 dark:bg-red-900/5' : 'bg-slate-50 dark:bg-slate-800/30'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isUp ? 'bg-emerald-500' : isDown ? 'bg-red-500' : 'bg-slate-400'}`} />
                              <span className="text-sm font-black text-slate-900 dark:text-white">{iface.name}</span>
                              <span className="text-[8px] text-slate-400 font-mono">idx {iface.index}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {hasErrs && <AlertTriangle size={11} className="text-amber-500" title="Errors detected" />}
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${isUp ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : isDown ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                {iface.operStatus}
                              </span>
                            </div>
                          </div>

                          {/* Interface stats */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100 dark:divide-slate-700/50">
                            {[
                              { label: 'Speed',    value: fmtSpeed(iface.speedBps),   icon: Signal   },
                              { label: 'In',       value: fmtBytes(iface.inOctets),   icon: Database },
                              { label: 'Out',      value: fmtBytes(iface.outOctets),  icon: Database },
                              { label: 'Errors',   value: ((iface.inErrors ?? 0) + (iface.outErrors ?? 0)) > 0 ? `${(iface.inErrors ?? 0)}↓ ${(iface.outErrors ?? 0)}↑` : '0', icon: AlertTriangle },
                            ].map(stat => (
                              <div key={stat.label} className="flex flex-col items-center justify-center py-3 px-3 gap-1">
                                <stat.icon size={10} className="text-slate-400" />
                                <p className="text-xs font-black text-slate-900 dark:text-white">{stat.value}</p>
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{stat.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <p className="text-[10px] text-slate-400 font-medium text-center">
            Data polled live via SNMP · interfaces 1–12 scanned · refresh to update
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Probe panel shown inside each POP unit card ───────────────────────────────
const PopProbePanel: React.FC<{ unit: Unit; onDetailsClick?: () => void }> = ({ unit, onDetailsClick }) => {
  const [result,   setResult]   = useState<PopProbeResult>(defaultProbeResult());
  const [isProbing, setIsProbing] = useState(false);
  const mountedRef = useRef(true);

  const runProbe = useCallback(async () => {
    if (!unit.snmpConfig?.host) return;
    setIsProbing(true);
    setResult(prev => ({ ping: { ...prev.ping, status: 'checking' }, snmp: { ...prev.snmp, status: 'checking' } }));
    const r = await probeUnit(unit);
    if (mountedRef.current) { setResult(r); setIsProbing(false); }
  }, [unit]);

  useEffect(() => {
    mountedRef.current = true;
    runProbe();
    const interval = setInterval(runProbe, 5 * 60 * 1000);
    return () => { mountedRef.current = false; clearInterval(interval); };
  }, [runProbe]);

  if (!unit.snmpConfig?.host) return null;

  const overallUp   = result.ping.status === 'up'   && result.snmp.status === 'up';
  const overallDown = result.ping.status === 'down'  || result.snmp.status === 'down';
  const checking    = result.ping.status === 'checking' || result.snmp.status === 'checking';
  const lastChecked = result.snmp.checkedAt
    ? new Date(result.snmp.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className={`mt-3 rounded-2xl border overflow-hidden transition-all ${
      checking    ? 'border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/5' :
      overallUp   ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-900/5' :
      overallDown ? 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/5' :
      'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
    }`}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-inherit">
        <div className="flex items-center gap-2">
          <Activity size={11} className={checking ? 'text-blue-500 animate-pulse' : overallUp ? 'text-emerald-500' : overallDown ? 'text-red-500' : 'text-slate-400'} />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Live Monitor</span>
          {lastChecked && <span className="text-[8px] text-slate-400 font-medium">· checked {lastChecked}</span>}
        </div>
        <div className="flex items-center gap-1">
          {onDetailsClick && (
            <button
              type="button"
              onClick={onDetailsClick}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-[#E31E24] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-[9px] font-black uppercase tracking-widest"
              title="View full SNMP details"
            >
              <Info size={10} /> Details
            </button>
          )}
          <button
            type="button"
            onClick={runProbe}
            disabled={isProbing}
            className="p-1 rounded-lg text-slate-400 hover:text-[#E31E24] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
            title="Re-probe now"
          >
            <RefreshCw size={11} className={isProbing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Status rows */}
      <div className="px-4 py-3 space-y-2">
        <StatusPill label="Ping" status={result.ping.status} detail={result.ping.latencyMs !== undefined ? `${result.ping.latencyMs}ms` : result.ping.error} icon={Signal} />
        <StatusPill label="SNMP" status={result.snmp.status} detail={result.snmp.uptime ? `Uptime: ${result.snmp.uptime}` : result.snmp.error} icon={Radio} />

        {result.ping.status === 'down' && result.ping.error && (
          <div className="flex items-start gap-1.5 px-1">
            <XCircle size={9} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[9px] text-red-500 dark:text-red-400 font-medium leading-relaxed">Ping: {result.ping.error}</p>
          </div>
        )}
        {result.snmp.status === 'down' && result.snmp.error && (
          <div className="flex items-start gap-1.5 px-1">
            <XCircle size={9} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[9px] text-red-500 dark:text-red-400 font-medium leading-relaxed">SNMP: {result.snmp.error}</p>
          </div>
        )}
        {result.ping.status === 'error' && result.ping.error && (
          <div className="flex items-start gap-1.5 px-1">
            <AlertTriangle size={9} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium leading-relaxed">Probe error: {result.ping.error}</p>
          </div>
        )}
        {result.snmp.status === 'up' && result.snmp.uptime && (
          <div className="flex items-center gap-1.5 px-1">
            <Clock size={9} className="text-emerald-500 flex-shrink-0" />
            <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium">Uptime: {result.snmp.uptime}</p>
          </div>
        )}
        {result.snmp.status === 'up' && result.snmp.sysDescr && (
          <div className="flex items-center gap-1.5 px-1">
            <Wifi size={9} className="text-emerald-500 flex-shrink-0" />
            <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium truncate" title={result.snmp.sysDescr}>{result.snmp.sysDescr}</p>
          </div>
        )}
        {result.ping.status === 'up' && result.ping.latencyMs !== undefined && (
          <div className="flex items-center gap-1.5 px-1">
            <Signal size={9} className="text-emerald-500 flex-shrink-0" />
            <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium">Latency: {result.ping.latencyMs}ms</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Modal shell ───────────────────────────────────────────────────────────────
const Modal: React.FC<{ title: string; icon: React.ReactNode; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode; }> = ({ title, icon, onClose, onSubmit, children }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
      <div className="p-7 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#E31E24]/10 rounded-2xl text-[#E31E24]">{icon}</div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
        </div>
        <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 transition-all"><X size={20} /></button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-7 space-y-5">{children}</div>
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900 rounded-b-[2.5rem]">
          <button type="submit" className="w-full py-4 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2">
            <Save size={15} /> Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
);

const ConfirmDelete: React.FC<{ name: string; onConfirm: () => void; onCancel: () => void; }> = ({ name, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6">
      <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-full w-fit mx-auto"><AlertTriangle size={28} className="text-rose-500" /></div>
      <div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirm Delete</h3>
        <p className="text-sm text-slate-500 mt-2">Are you sure you want to delete <span className="font-black text-slate-900 dark:text-white">"{name}"</span>? This cannot be undone.</p>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancel</button>
        <button type="button" onClick={onConfirm} className="flex-1 py-3 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-900/20">Delete</button>
      </div>
    </div>
  </div>
);

// ── Unit type config ──────────────────────────────────────────────────────────
const UNIT_TYPES: { value: UnitType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'office', label: 'Office',       icon: Building2, desc: 'Geofence only'           },
  { value: 'pop',    label: 'POP',          icon: Radio,     desc: 'Network node'             },
  { value: 'both',   label: 'Office + POP', icon: Network,   desc: 'Office with network node' },
];

const UNIT_TYPE_BADGE: Record<UnitType, { bg: string; text: string; label: string }> = {
  office: { bg: 'bg-blue-100 dark:bg-blue-900/20',      text: 'text-blue-600 dark:text-blue-400',       label: 'Office'       },
  pop:    { bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'POP'          },
  both:   { bg: 'bg-violet-100 dark:bg-violet-900/20',  text: 'text-violet-600 dark:text-violet-400',   label: 'Office + POP' },
};

// ── SNMP sub-form ─────────────────────────────────────────────────────────────
const defaultSnmp = (): SnmpConfig => ({ host: '', community: 'public', port: 161, oid: '' });

const SnmpForm: React.FC<{ value: SnmpConfig; onChange: (v: SnmpConfig) => void }> = ({ value, onChange }) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-200 dark:border-emerald-900/40 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-2 px-5 py-3 text-left">
        <Radio size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex-1">SNMP + Ping Configuration</span>
        <Lock size={11} className="text-emerald-500 mr-1" />
        {expanded ? <ChevronUp size={14} className="text-emerald-500" /> : <ChevronDown size={14} className="text-emerald-500" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-emerald-200 dark:border-emerald-900/40 pt-4">
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium leading-relaxed">
            The backend probe will ping the host <strong>and</strong> poll SNMP. Wrong credentials or an unreachable host will correctly show as <strong>DOWN</strong>.
          </p>
          <div>
            <label className={labelCls}>Management IP / Hostname <span className="text-red-400">*</span></label>
            <input type="text" required className={inputCls} value={value.host} onChange={e => onChange({ ...value, host: e.target.value })} placeholder="192.168.1.1 or pop.local" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Community String <span className="text-red-400">*</span></label>
              <input type="password" required autoComplete="new-password" className={inputCls} value={value.community} onChange={e => onChange({ ...value, community: e.target.value })} placeholder="public" />
            </div>
            <div>
              <label className={labelCls}>Port</label>
              <input type="number" min={1} max={65535} className={inputCls} value={value.port} onChange={e => onChange({ ...value, port: parseInt(e.target.value) || 161 })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Custom OID <span className="font-medium normal-case tracking-normal text-slate-400">(optional — defaults to sysUpTime)</span></label>
            <input type="text" className={inputCls} value={value.oid || ''} onChange={e => onChange({ ...value, oid: e.target.value })} placeholder="1.3.6.1.2.1.1.3.0" />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Unit type picker ──────────────────────────────────────────────────────────
const UnitTypePicker: React.FC<{ value: UnitType; onChange: (v: UnitType) => void }> = ({ value, onChange }) => (
  <div>
    <label className={labelCls}>Unit Type <span className="text-red-400">*</span></label>
    <div className="grid grid-cols-3 gap-2">
      {UNIT_TYPES.map(opt => {
        const Icon = opt.icon;
        const isActive = value === opt.value;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all text-center ${isActive ? 'border-[#E31E24] bg-[#E31E24]/5 dark:bg-[#E31E24]/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
            <Icon size={16} className={isActive ? 'text-[#E31E24]' : 'text-slate-400'} />
            <span className={`text-[10px] font-black uppercase tracking-wider leading-tight ${isActive ? 'text-[#E31E24]' : 'text-slate-500 dark:text-slate-400'}`}>{opt.label}</span>
            <span className="text-[8px] text-slate-400 leading-tight">{opt.desc}</span>
          </button>
        );
      })}
    </div>
  </div>
);

// ── Form state types ──────────────────────────────────────────────────────────
type UnitForm = { name: string; lat: string; lng: string; radius: string; unitType: UnitType; deviceType: DeviceType; snmpConfig: SnmpConfig; headUserId: string };
type EditUnitForm = { id: string } & UnitForm;
const defaultUnit = (): UnitForm => ({ name: '', lat: '23.8103', lng: '90.4125', radius: '100', unitType: 'office', deviceType: 'router', snmpConfig: defaultSnmp(), headUserId: '' });
const isPopUnit = (t: UnitType) => t === 'pop' || t === 'both';

// ─────────────────────────────────────────────────────────────────────────────

const InfrastructureView: React.FC = () => {
  const { units, departments, users, addUnit, updateUnit, addDepartment, updateDepartment, deleteUnit, deleteDepartment, departmentDelegates, setDepartmentDelegate, removeDepartmentDelegate } = useHRM();

  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [editingUnit,  setEditingUnit]  = useState<EditUnitForm | null>(null);
  const [editingDept,  setEditingDept]  = useState<Department | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [delegateDept, setDelegateDept] = useState<string | null>(null); // dept name being assigned
  const [delegateSearch, setDelegateSearch] = useState('');
  const [delegateSaving, setDelegateSaving] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState<string | null>(null);
  const [newUnit,      setNewUnit]      = useState<UnitForm>(defaultUnit);
  const [detailUnit,   setDetailUnit]   = useState<Unit | null>(null);   // ← detail modal
  const [newDept,      setNewDept]      = useState<Omit<Department, 'id'> & { unitIds: string[] }>({
    name: '', unitId: units[0]?.id || '', unitIds: units[0]?.id ? [units[0].id] : [],
  });

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    addUnit({
      name: newUnit.name,
      lat: parseFloat(newUnit.lat) || 0,
      lng: parseFloat(newUnit.lng) || 0,
      radius: parseInt(newUnit.radius) || 100,
      unitType: newUnit.unitType,
      deviceType: isPopUnit(newUnit.unitType) ? newUnit.deviceType : undefined,
      snmpConfig: isPopUnit(newUnit.unitType) ? newUnit.snmpConfig : undefined,
      headUserId: newUnit.headUserId || undefined,
    });
    setIsAddingUnit(false);
    setNewUnit(defaultUnit());
  };

  const handleAddDept = (e: React.FormEvent) => {
    e.preventDefault();
    const unitIds = newDept.unitIds.length ? newDept.unitIds : [newDept.unitId].filter(Boolean);
    addDepartment({ name: newDept.name, unitId: unitIds[0] || '', unitIds } as any);
    setIsAddingDept(false);
    setNewDept({ name: '', unitId: units[0]?.id || '', unitIds: units[0]?.id ? [units[0].id] : [] });
  };

  const handleUpdateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    updateUnit(editingUnit.id, {
      name: editingUnit.name,
      lat: parseFloat(editingUnit.lat) || 0,
      lng: parseFloat(editingUnit.lng) || 0,
      radius: parseInt(editingUnit.radius) || 100,
      unitType: editingUnit.unitType,
      deviceType: isPopUnit(editingUnit.unitType) ? editingUnit.deviceType : undefined,
      snmpConfig: isPopUnit(editingUnit.unitType) ? editingUnit.snmpConfig : undefined,
      headUserId: editingUnit.headUserId || undefined,
    });
    setEditingUnit(null);
  };

  const handleUpdateDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    const unitIds = (editingDept as any).unitIds?.length ? (editingDept as any).unitIds : [editingDept.unitId].filter(Boolean);
    updateDepartment(editingDept.id, { ...editingDept, unitId: unitIds[0], unitIds } as any);
    setEditingDept(null);
  };

  const popUnits = units.filter(u => isPopUnit(u.unitType || 'office'));

  return (
    <div className="space-y-10 animate-[fadeIn_0.6s_ease-out] pb-20">

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter font-jakarta">Infrastructure Control</h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">Manage physical units, POPs and organizational departments.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => setIsAddingUnit(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#E31E24] transition-all shadow-lg">
            <Building2 size={16} /> New Unit
          </button>
          <button type="button" onClick={() => setIsAddingDept(true)} className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/20">
            <Plus size={16} /> New Dept
          </button>
        </div>
      </div>

      {/* ── POP Network Monitor ── */}
      {popUnits.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Activity className="text-[#E31E24]" size={22} />
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">POP Network Monitor</h3>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black">{popUnits.length} node{popUnits.length !== 1 ? 's' : ''}</span>
            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-[9px] font-black uppercase tracking-widest">Auto-refresh 5 min</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {popUnits.map(unit => {
              const uType   = unit.unitType || 'office' as UnitType;
              const typeCfg = UNIT_TYPE_BADGE[uType];
              const hasSnmp = !!unit.snmpConfig?.host;
              const devType = unit.deviceType;
              const devCfg  = devType ? DEVICE_TYPE_BADGE[devType] : null;
              const devInfo = devType ? DEVICE_TYPES.find(d => d.value === devType) : null;

              return (
                <div key={unit.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 transition-all hover:border-slate-300 dark:hover:border-slate-700 soft-shadow">
                  <div className="flex items-start gap-3 mb-1">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                      <Radio size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{unit.name}</h4>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${typeCfg.bg} ${typeCfg.text}`}>{typeCfg.label}</span>
                        {devCfg && devInfo && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${devCfg.bg} ${devCfg.text}`}>
                            {devInfo.emoji} {devInfo.label}
                          </span>
                        )}
                      </div>
                      {hasSnmp ? (
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">{unit.snmpConfig!.host}:{unit.snmpConfig!.port}</p>
                      ) : (
                        <p className="text-[9px] text-amber-500 font-bold mt-0.5">⚠ No SNMP configured</p>
                      )}
                    </div>
                  </div>

                  {hasSnmp
                    ? <PopProbePanel unit={unit} onDetailsClick={() => setDetailUnit(unit)} />
                    : (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-900/30">
                        <p className="text-[9px] text-amber-700 dark:text-amber-400 font-bold">Configure SNMP to enable live monitoring for this POP.</p>
                      </div>
                    )
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* ── Units ── */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Globe className="text-[#E31E24]" size={22} />
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Active Units</h3>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black">{units.length}</span>
          </div>
          <div className="space-y-4">
            {units.map(unit => {
              const uType   = unit.unitType || 'office' as UnitType;
              const typeCfg = UNIT_TYPE_BADGE[uType];
              const hasSnmp = isPopUnit(uType) && !!unit.snmpConfig?.host;
              const devType = unit.deviceType;
              const devInfo = devType ? DEVICE_TYPES.find(d => d.value === devType) : null;
              return (
                <div key={unit.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 hover:border-[#E31E24] transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 group-hover:bg-[#E31E24] group-hover:text-white transition-all">
                        <Building2 size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-slate-900 dark:text-white">{unit.name}</h4>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${typeCfg.bg} ${typeCfg.text}`}>{typeCfg.label}</span>
                          {devInfo && (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {devInfo.emoji} {devInfo.label}
                            </span>
                          )}
                          {isPopUnit(uType) && (
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${hasSnmp ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
                              {hasSnmp ? '🔌 SNMP Set' : '⚠ No SNMP'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{unit.id}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isPopUnit(uType) && hasSnmp && (
                        <button
                          type="button"
                          onClick={() => setDetailUnit(unit)}
                          className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                          title="View SNMP details"
                        >
                          <Info size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingUnit({
                          id: unit.id, name: unit.name,
                          lat: String(unit.lat), lng: String(unit.lng), radius: String(unit.radius),
                          unitType: uType,
                          deviceType: unit.deviceType || 'router',
                          snmpConfig: unit.snmpConfig ? { ...unit.snmpConfig } : defaultSnmp(),
                          headUserId: unit.headUserId || '',
                        })}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button type="button" onClick={() => setDeletingUnit(unit)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Coordinates</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <MapPin size={11} className="text-[#E31E24]" />{unit.lat == null || unit.lng == null ? 'Coordinates unavailable' : `${unit.lat.toFixed(4)}, ${unit.lng.toFixed(4)}`}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Geofence</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Shield size={11} className="text-[#E31E24]" />{unit.radius}m radius
                      </p>
                    </div>
                  </div>

                  {hasSnmp && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center gap-2">
                      <Wifi size={11} className="text-slate-400 flex-shrink-0" />
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono truncate">{unit.snmpConfig!.host}:{unit.snmpConfig!.port}</p>
                      <span className="ml-auto text-[8px] text-slate-400 font-bold uppercase tracking-widest">↑ Live status above</span>
                    </div>
                  )}
                </div>
              );
            })}
            {units.length === 0 && <p className="text-sm text-slate-400 italic text-center py-10">No units configured.</p>}
          </div>
        </div>

        {/* ── Departments ── */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Shield className="text-[#E31E24]" size={22} />
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Departments</h3>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black">{departments.length}</span>
          </div>
          <div className="space-y-4">
            {departments.map(dept => (
              <div key={dept.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 hover:border-[#E31E24] transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-400 group-hover:bg-[#E31E24] group-hover:text-white transition-all">
                      <Hash size={22} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">{dept.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Building2 size={10} className="text-[#E31E24] flex-shrink-0" />
                        {(dept.unitIds?.length ? dept.unitIds : [dept.unitId]).map(uid => {
                          const u = units.find(x => x.id === uid);
                          return u ? <span key={uid} className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{u.name}</span> : null;
                        })}
                        {!dept.unitIds?.length && !dept.unitId && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Unassigned</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setDelegateDept(dept.name); setDelegateSearch(''); setDelegateMsg(null); }} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all" title="Set acting manager"><UserCheck size={16} /></button>
                    <button type="button" onClick={() => setEditingDept({ ...dept })} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => setDeletingDept(dept)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
                {(() => {
                  const del = (departmentDelegates || []).find(d => d.department === dept.name);
                  if (!del) return null;
                  return (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <UserCheck size={12} className="text-amber-500 flex-shrink-0" />
                      <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 flex-1">
                        Acting Manager: <span className="text-slate-900 dark:text-white">{del.delegateUserName}</span>
                      </p>
                      <button onClick={async () => { await removeDepartmentDelegate(dept.name); }} className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest">Remove</button>
                    </div>
                  );
                })()}
              </div>
            ))}
            {departments.length === 0 && <p className="text-sm text-slate-400 italic text-center py-10">No departments configured.</p>}
          </div>
        </div>
      </div>

      {/* ── Add Unit Modal ── */}
      {isAddingUnit && (
        <Modal title="Add New Unit" icon={<Building2 size={20} />} onClose={() => setIsAddingUnit(false)} onSubmit={handleAddUnit}>
          <div><label className={labelCls}>Unit Name</label><input autoFocus required className={inputCls} value={newUnit.name} onChange={e => setNewUnit({ ...newUnit, name: e.target.value })} placeholder="e.g. Dhaka HQ" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Latitude</label><input type="text" inputMode="decimal" required className={inputCls} value={newUnit.lat} onChange={e => setNewUnit({ ...newUnit, lat: e.target.value })} /></div>
            <div><label className={labelCls}>Longitude</label><input type="text" inputMode="decimal" required className={inputCls} value={newUnit.lng} onChange={e => setNewUnit({ ...newUnit, lng: e.target.value })} /></div>
          </div>
          <div><label className={labelCls}>Geofence Radius (meters)</label><input type="text" inputMode="numeric" required className={inputCls} value={newUnit.radius} onChange={e => setNewUnit({ ...newUnit, radius: e.target.value })} /></div>
          <div>
            <label className={labelCls}>Unit Head / Senior Approver <span className="font-medium normal-case tracking-normal text-slate-400">(optional — first step in leave approval)</span></label>
            <select className={inputCls} value={newUnit.headUserId} onChange={e => setNewUnit({ ...newUnit, headUserId: e.target.value })}>
              <option value="">— None —</option>
              {users.filter(u => u.role !== UserRole.DEVELOPER && u.role !== UserRole.ADMIN).map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.designation || u.role} · {u.department}</option>
              ))}
            </select>
          </div>
          <UnitTypePicker value={newUnit.unitType} onChange={v => setNewUnit({ ...newUnit, unitType: v })} />
          {isPopUnit(newUnit.unitType) && (
            <>
              <DeviceTypePicker value={newUnit.deviceType} onChange={v => setNewUnit({ ...newUnit, deviceType: v })} />
              <SnmpForm value={newUnit.snmpConfig} onChange={v => setNewUnit({ ...newUnit, snmpConfig: v })} />
            </>
          )}
        </Modal>
      )}

      {/* ── Edit Unit Modal ── */}
      {editingUnit && (
        <Modal title="Edit Unit" icon={<Edit2 size={20} />} onClose={() => setEditingUnit(null)} onSubmit={handleUpdateUnit}>
          <div><label className={labelCls}>Unit Name</label><input autoFocus required className={inputCls} value={editingUnit.name} onChange={e => setEditingUnit({ ...editingUnit, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Latitude</label><input type="text" inputMode="decimal" required className={inputCls} value={editingUnit.lat} onChange={e => setEditingUnit({ ...editingUnit, lat: e.target.value })} /></div>
            <div><label className={labelCls}>Longitude</label><input type="text" inputMode="decimal" required className={inputCls} value={editingUnit.lng} onChange={e => setEditingUnit({ ...editingUnit, lng: e.target.value })} /></div>
          </div>
          <div><label className={labelCls}>Geofence Radius (meters)</label><input type="text" inputMode="numeric" required className={inputCls} value={editingUnit.radius} onChange={e => setEditingUnit({ ...editingUnit, radius: e.target.value })} /></div>
          <div>
            <label className={labelCls}>Unit Head / Senior Approver <span className="font-medium normal-case tracking-normal text-slate-400">(first step in leave approval)</span></label>
            <select className={inputCls} value={editingUnit.headUserId} onChange={e => setEditingUnit({ ...editingUnit, headUserId: e.target.value })}>
              <option value="">— None —</option>
              {users.filter(u => u.role !== UserRole.DEVELOPER && u.role !== UserRole.ADMIN).map(u => (
                <option key={u.id} value={u.id}>{u.name} — {u.designation || u.role} · {u.department}</option>
              ))}
            </select>
          </div>
          <UnitTypePicker value={editingUnit.unitType} onChange={v => setEditingUnit({ ...editingUnit, unitType: v })} />
          {isPopUnit(editingUnit.unitType) && (
            <>
              <DeviceTypePicker value={editingUnit.deviceType} onChange={v => setEditingUnit({ ...editingUnit, deviceType: v })} />
              <SnmpForm value={editingUnit.snmpConfig} onChange={v => setEditingUnit({ ...editingUnit, snmpConfig: v })} />
            </>
          )}
        </Modal>
      )}

      {/* ── Add Dept Modal ── */}
      {isAddingDept && (
        <Modal title="Add Department" icon={<Hash size={20} />} onClose={() => setIsAddingDept(false)} onSubmit={handleAddDept}>
          <div><label className={labelCls}>Department Name</label><input autoFocus required className={inputCls} value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })} placeholder="e.g. Field Engineering" /></div>
          <div>
            <label className={labelCls}>Assign to Units <span className="font-medium normal-case tracking-normal text-slate-400">(select all that apply)</span></label>
            {units.length === 0 && <p className="text-xs text-slate-400 italic">No units yet. Add a unit first.</p>}
            <div className="space-y-2 mt-1">
              {units.map(u => {
                const checked = newDept.unitIds.includes(u.id);
                const uType: UnitType = u.unitType || 'office';
                return (
                  <label key={u.id} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${checked ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <input type="checkbox" checked={checked}
                      onChange={e => { const ids = e.target.checked ? [...newDept.unitIds, u.id] : newDept.unitIds.filter(id => id !== u.id); setNewDept({ ...newDept, unitId: ids[0] || '', unitIds: ids }); }}
                      className="w-4 h-4 accent-[#E31E24]" />
                    <span className="text-sm font-black text-slate-900 dark:text-white">{u.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${UNIT_TYPE_BADGE[uType].bg} ${UNIT_TYPE_BADGE[uType].text}`}>{UNIT_TYPE_BADGE[uType].label}</span>
                    <span className="ml-auto text-[9px] font-bold text-slate-400 font-mono">{u.lat == null || u.lng == null ? 'Coordinates unavailable' : `${u.lat.toFixed(3)}, ${u.lng.toFixed(3)}`}</span>
                  </label>
                );
              })}
            </div>
            {newDept.unitIds.length === 0 && units.length > 0 && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-2">⚠ Select at least one unit.</p>}
          </div>
        </Modal>
      )}

      {/* ── Edit Dept Modal ── */}
      {editingDept && (
        <Modal title="Edit Department" icon={<Edit2 size={20} />} onClose={() => setEditingDept(null)} onSubmit={handleUpdateDept}>
          <div><label className={labelCls}>Department Name</label><input autoFocus required className={inputCls} value={editingDept.name} onChange={e => setEditingDept({ ...editingDept, name: e.target.value })} /></div>
          <div>
            <label className={labelCls}>Assigned Units <span className="font-medium normal-case tracking-normal text-slate-400">(select all that apply)</span></label>
            <div className="space-y-2 mt-1">
              {units.map(u => {
                const currentIds: string[] = (editingDept as any).unitIds?.length ? (editingDept as any).unitIds : [editingDept.unitId].filter(Boolean);
                const checked = currentIds.includes(u.id);
                const uType: UnitType = u.unitType || 'office';
                return (
                  <label key={u.id} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${checked ? 'border-[#E31E24] bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <input type="checkbox" checked={checked}
                      onChange={e => { const ids = e.target.checked ? [...currentIds, u.id] : currentIds.filter(id => id !== u.id); setEditingDept({ ...editingDept, unitId: ids[0] || '', unitIds: ids } as any); }}
                      className="w-4 h-4 accent-[#E31E24]" />
                    <span className="text-sm font-black text-slate-900 dark:text-white">{u.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${UNIT_TYPE_BADGE[uType].bg} ${UNIT_TYPE_BADGE[uType].text}`}>{UNIT_TYPE_BADGE[uType].label}</span>
                    <span className="ml-auto text-[9px] font-bold text-slate-400 font-mono">{u.lat == null || u.lng == null ? 'Coordinates unavailable' : `${u.lat.toFixed(3)}, ${u.lng.toFixed(3)}`}</span>
                  </label>
                );
              })}
            </div>
            {!(editingDept as any).unitIds?.length && !editingDept.unitId && <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-2">⚠ Select at least one unit.</p>}
          </div>
        </Modal>
      )}

      {/* ── Detail Modal ── */}
      {detailUnit && <DeviceDetailModal unit={detailUnit} onClose={() => setDetailUnit(null)} />}

      {deletingUnit && <ConfirmDelete name={deletingUnit.name} onCancel={() => setDeletingUnit(null)} onConfirm={() => { deleteUnit(deletingUnit.id); setDeletingUnit(null); }} />}
      {deletingDept && <ConfirmDelete name={deletingDept.name} onCancel={() => setDeletingDept(null)} onConfirm={() => { deleteDepartment(deletingDept.id); setDeletingDept(null); }} />}
      {/* ─── Acting Manager Assignment Modal ─────────────────────────────── */}
      {delegateDept && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center">
                  <UserCheck size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white">Set Acting Manager</p>
                  <p className="text-[10px] text-slate-400 font-bold">{delegateDept}</p>
                </div>
              </div>
              <button onClick={() => { setDelegateDept(null); setDelegateMsg(null); }} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assign an employee as the acting manager for <strong className="text-slate-900 dark:text-white">{delegateDept}</strong>. They will receive approval requests when the primary manager is unavailable.
              </p>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="text" placeholder="Search employee by name or ID..." value={delegateSearch}
                  onChange={e => setDelegateSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white focus:border-amber-400 outline-none" />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar">
                {users.filter(u => {
                  const q = delegateSearch.toLowerCase();
                  return !q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
                }).map(u => {
                  const isCurrentDelegate = (departmentDelegates || []).find(d => d.department === delegateDept)?.delegateUserId === u.id;
                  return (
                    <button key={u.id} onClick={async () => {
                      setDelegateSaving(true); setDelegateMsg(null);
                      const res = await setDepartmentDelegate(delegateDept, u.id);
                      setDelegateMsg(res.message);
                      setDelegateSaving(false);
                      if (res.success) setTimeout(() => { setDelegateDept(null); setDelegateMsg(null); }, 1500);
                    }}
                      disabled={delegateSaving}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${isCurrentDelegate ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10'}`}>
                      <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-black text-slate-600 dark:text-slate-300">{u.name.charAt(0)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{u.id} · {u.department}</p>
                      </div>
                      {isCurrentDelegate && <span className="text-[9px] font-black text-amber-600 uppercase">Current</span>}
                    </button>
                  );
                })}
              </div>
              {delegateMsg && (
                <div className={`p-3 rounded-2xl text-xs font-black text-center ${delegateMsg.startsWith('✅') || !delegateMsg.includes('error') && !delegateMsg.includes('failed') && !delegateMsg.includes('not found') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/10 dark:text-rose-400'}`}>
                  {delegateMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfrastructureView;
