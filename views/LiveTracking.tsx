import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useHRM } from '../store';
import L from 'leaflet';
import {
  Users, Target, Activity, RefreshCw, Plus,
  Radio, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { Unit } from '../types';

// ── POP Health Types ──────────────────────────────────────────────────────────
type PopStatus = 'up' | 'down' | 'unknown' | 'checking';

interface PopHealth {
  unitId: string;
  status: PopStatus;
  latencyMs: number | null;
  lastChecked: Date | null;
  consecutiveFails: number;
}

// ── Probe a POP unit via HTTP HEAD ───────────────────────────────────────────
// Browsers cannot do raw SNMP (UDP 161). We probe each unit's management
// endpoint via HTTP. The relative URL /pop-probe/<unitId>/ should be
// reverse-proxied by Nginx to the unit's management IP.
// Any non-timeout response (including 401/403) = device is alive.
// To add a real management IP field, add `mgmtIp?: string` to the Unit type
// in types.ts and use it here instead of the unit ID path.
const PROBE_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 30000;

const probeUnit = async (unit: Unit): Promise<{ alive: boolean; latencyMs: number }> => {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`/pop-probe/${unit.id}/`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { alive: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    clearTimeout(timer);
    return { alive: false, latencyMs: err?.name === 'AbortError' ? PROBE_TIMEOUT_MS : Date.now() - start };
  }
};

// ── Colours & labels ──────────────────────────────────────────────────────────
const STATUS_COLOR: Record<PopStatus, string> = {
  up:       '#10b981',
  down:     '#ef4444',
  unknown:  '#94a3b8',
  checking: '#f59e0b',
};
const STATUS_LABEL: Record<PopStatus, string> = {
  up: 'Online', down: 'Offline', unknown: 'Unknown', checking: 'Probing…',
};

// ── Unit map-marker HTML ──────────────────────────────────────────────────────
const unitMarkerHtml = (status: PopStatus, name: string): string => {
  const c = STATUS_COLOR[status];
  const pulse = status === 'up'
    ? `<span class="absolute inset-0 rounded-xl animate-ping opacity-40" style="background:${c}"></span>` : '';
  return `
    <div style="display:flex;flex-direction:column;align-items:center;width:52px;">
      <div class="relative" style="width:36px;height:36px;background:${c};border-radius:10px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.25);">
        ${pulse}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
          ${status === 'up'
            ? '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="white"/>'
            : status === 'down'
            ? '<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="white"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
          }
        </svg>
      </div>
      <div style="margin-top:3px;padding:1px 5px;background:${c};border-radius:5px;color:white;font-size:7px;font-weight:900;letter-spacing:0.05em;max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase;">
        ${name.length > 9 ? name.slice(0, 8) + '…' : name}
      </div>
    </div>`;
};

// ─────────────────────────────────────────────────────────────────────────────

const LiveTracking: React.FC = () => {
  const { gpsLogs, users, units, refreshGpsLogs } = useHRM();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<L.Map | null>(null);
  const userMarkersRef   = useRef<Record<string, L.Marker>>({});
  const unitMarkersRef   = useRef<Record<string, L.Marker>>({});
  const unitCirclesRef   = useRef<Record<string, L.Circle>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [lastUpdate,   setLastUpdate]   = useState<Date>(new Date());

  // POP health
  const [popHealth, setPopHealth] = useState<Record<string, PopHealth>>({});
  const [isProbing, setIsProbing] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { refreshGpsLogs(); }, [refreshGpsLogs]);

  // Only probe units that are POP or Office+POP
  const popUnits = units.filter(u => u.unitType === 'pop' || u.unitType === 'both');

  // ── Probe all units ─────────────────────────────────────────────────────────
  const probeAllUnits = useCallback(async () => {
    if (!popUnits.length) return;
    setIsProbing(true);
    setPopHealth(prev => {
      const next = { ...prev };
      popUnits.forEach(u => {
        next[u.id] = { unitId: u.id, status: 'checking', latencyMs: prev[u.id]?.latencyMs ?? null, lastChecked: prev[u.id]?.lastChecked ?? null, consecutiveFails: prev[u.id]?.consecutiveFails ?? 0 };
      });
      return next;
    });

    const results = await Promise.all(popUnits.map(async u => ({ u, ...(await probeUnit(u)) })));

    setPopHealth(prev => {
      const next = { ...prev };
      results.forEach(({ u, alive, latencyMs }) => {
        const fails = alive ? 0 : (prev[u.id]?.consecutiveFails ?? 0) + 1;
        next[u.id] = { unitId: u.id, status: alive ? 'up' : 'down', latencyMs: alive ? latencyMs : null, lastChecked: new Date(), consecutiveFails: fails };
      });
      return next;
    });

    setIsProbing(false);
    setLastUpdate(new Date());
  }, [units]);

  // Init probe + polling — only for POP/both units
  useEffect(() => {
    if (!popUnits.length) return;
    setPopHealth(Object.fromEntries(popUnits.map(u => [u.id, { unitId: u.id, status: 'unknown' as PopStatus, latencyMs: null, lastChecked: null, consecutiveFails: 0 }])));
    probeAllUnits();
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(probeAllUnits, POLL_INTERVAL_MS);
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popUnits.length]);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false })
      .setView([units[0]?.lat || 23.8103, units[0]?.lng || 90.4125], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 100);
    setTimeout(() => mapRef.current?.invalidateSize(), 600);
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(mapContainerRef.current);
    return () => { ro.disconnect(); mapRef.current?.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !units.length) return;
    mapRef.current.setView([units[0].lat, units[0].lng], mapRef.current.getZoom(), { animate: false });
  }, [units]);

  // ── Unit markers — update colour whenever health changes ────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    units.forEach(unit => {
      const isPop = unit.unitType === 'pop' || unit.unitType === 'both';
      const health  = isPop ? popHealth[unit.id] : undefined;
      // Office-only units always show as 'unknown' (grey) — no probing
      const status: PopStatus = isPop ? (health?.status ?? 'unknown') : 'unknown';
      const color   = STATUS_COLOR[status];
      const latlng: [number, number] = [unit.lat, unit.lng];

      // Update or create the marker
      if (unitMarkersRef.current[unit.id]) {
        unitMarkersRef.current[unit.id].setIcon(L.divIcon({
          className: 'pop-unit-marker',
          html: unitMarkerHtml(status, unit.name),
          iconSize: [52, 52],
          iconAnchor: [26, 52],
        }));
        unitMarkersRef.current[unit.id].setLatLng(latlng);
        // Update popup
        unitMarkersRef.current[unit.id].setPopupContent(`
          <div style="padding:8px;min-width:140px">
            <p style="font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;font-size:13px">${unit.name}</p>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
              <span style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase">${STATUS_LABEL[status]}</span>
            </div>
            ${health?.latencyMs != null ? `<p style="font-size:9px;color:#94a3b8;margin-top:4px">Latency: ${health.latencyMs}ms</p>` : ''}
            <div style="border-top:1px solid #f1f5f9;margin-top:6px;padding-top:4px">
              <p style="font-size:8px;font-family:monospace;color:#94a3b8">${unit.lat.toFixed(5)}, ${unit.lng.toFixed(5)}<br>Radius: ${unit.radius}m</p>
            </div>
          </div>`);
      } else {
        // Geofence circle
        const circle = L.circle(latlng, {
          color, fillColor: color, fillOpacity: 0.07,
          radius: unit.radius, weight: 2, dashArray: status === 'down' ? '6,6' : '4,8',
        }).addTo(mapRef.current!);
        unitCirclesRef.current[unit.id] = circle;

        const marker = L.marker(latlng, {
          icon: L.divIcon({ className: 'pop-unit-marker', html: unitMarkerHtml(status, unit.name), iconSize: [52, 52], iconAnchor: [26, 52] }),
          zIndexOffset: 1000,
        }).addTo(mapRef.current!);

        marker.bindPopup(`
          <div style="padding:8px;min-width:140px">
            <p style="font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;font-size:13px">${unit.name}</p>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></span>
              <span style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase">${STATUS_LABEL[status]}</span>
            </div>
            ${health?.latencyMs != null ? `<p style="font-size:9px;color:#94a3b8;margin-top:4px">Latency: ${health.latencyMs}ms</p>` : ''}
            <div style="border-top:1px solid #f1f5f9;margin-top:6px;padding-top:4px">
              <p style="font-size:8px;font-family:monospace;color:#94a3b8">${unit.lat.toFixed(5)}, ${unit.lng.toFixed(5)}<br>Radius: ${unit.radius}m</p>
            </div>
          </div>`);

        unitMarkersRef.current[unit.id] = marker;
      }

      // Also update circle stroke colour
      if (unitCirclesRef.current[unit.id]) {
        unitCirclesRef.current[unit.id].setStyle({ color, fillColor: color, dashArray: status === 'down' ? '6,6' : '4,8' });
      }
    });
  }, [units, popHealth]);

  // ── User GPS markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const latest: Record<string, any> = {};
    gpsLogs.forEach(log => {
      if (!latest[log.userId] || new Date(log.timestamp) > new Date(latest[log.userId].timestamp)) latest[log.userId] = log;
    });
    Object.keys(userMarkersRef.current).forEach(uid => {
      if (!latest[uid]) { userMarkersRef.current[uid].remove(); delete userMarkersRef.current[uid]; }
    });
    Object.values(latest).forEach(pos => {
      const user = users.find(u => u.id === pos.userId);
      if (!user) return;
      const latlng: [number, number] = [pos.lat, pos.lng];
      if (userMarkersRef.current[pos.userId]) {
        userMarkersRef.current[pos.userId].setLatLng(latlng);
      } else {
        const m = L.marker(latlng, {
          icon: L.divIcon({
            className: 'user-telemetry-marker',
            html: `<div class="relative w-10 h-10 animate-[bounce_2s_infinite]">
              <div class="absolute inset-0 bg-red-600 rounded-2xl rotate-45 shadow-lg border-2 border-white"></div>
              <div class="absolute inset-0 flex items-center justify-center text-white font-black text-xs z-10">${user.name.charAt(0)}</div>
            </div>`,
            iconSize: [40, 40], iconAnchor: [20, 20],
          }),
        }).addTo(mapRef.current!)
          .bindPopup(`<div style="padding:8px"><p style="font-weight:900;text-transform:uppercase;margin-bottom:4px">${user.name}</p><p style="font-size:9px;color:#94a3b8;text-transform:uppercase;font-weight:700">${user.department}</p><p style="font-size:8px;font-family:monospace;color:#94a3b8;margin-top:6px">Lat: ${pos.lat.toFixed(5)}<br>Lng: ${pos.lng.toFixed(5)}</p></div>`);
        userMarkersRef.current[pos.userId] = m;
      }
      if (selectedUser === pos.userId) mapRef.current?.panTo(latlng, { animate: true });
    });
    setLastUpdate(new Date());
  }, [gpsLogs, users, selectedUser]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeUserIds = Array.from(new Set(gpsLogs.map(l => l.userId)));
  // Counts only reflect POP/both units — office-only units are excluded
  const upCount      = Object.values(popHealth as Record<string, any>).filter(h => h.status === 'up').length;
  const downCount    = Object.values(popHealth as Record<string, any>).filter(h => h.status === 'down').length;
  const unknownCount = Object.values(popHealth as Record<string, any>).filter(h => h.status === 'unknown' || h.status === 'checking').length;
  const officeOnlyCount = units.filter(u => !u.unitType || u.unitType === 'office').length;

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-[fadeIn_0.5s_ease-out]">

      {/* ── Left panel ── */}
      <div className="w-full lg:w-80 flex flex-col gap-4">

        {/* Summary pills */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Online',  value: upCount,      bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-900/50', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', pulse: true },
            { label: 'Offline', value: downCount,    bg: 'bg-red-50 dark:bg-red-900/10',         border: 'border-red-200 dark:border-red-900/40',         dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400',         pulse: false },
            { label: 'Unknown', value: unknownCount, bg: 'bg-slate-50 dark:bg-slate-800',        border: 'border-slate-200 dark:border-slate-700',        dot: 'bg-slate-400',   text: 'text-slate-500',                         pulse: false },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border-2 ${s.border} rounded-2xl p-3 text-center`}>
              <div className={`w-2 h-2 rounded-full ${s.dot} mx-auto mb-1.5 ${s.pulse ? 'animate-pulse' : ''}`} />
              <p className={`text-xl font-black ${s.text}`}>{s.value}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* POP list */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 soft-shadow flex flex-col overflow-hidden" style={{ maxHeight: 380 }}>
          <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"><Radio size={14} className="text-slate-600 dark:text-slate-300" /></div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">POP Status</h3>
            </div>
            <button onClick={probeAllUnits} disabled={isProbing} title="Re-probe all" className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all disabled:opacity-40">
              <RefreshCw size={13} className={isProbing ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-2">
            {units.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-6">No units configured.</p>}
            {popUnits.length === 0 && units.length > 0 && (
              <p className="text-[10px] text-slate-400 italic text-center py-6">
                No POP units configured.<br />
                <span className="text-[9px]">Set unit type to POP or Office+POP in Infrastructure.</span>
              </p>
            )}
            {popUnits.map(unit => {
              const h = popHealth[unit.id];
              const status: PopStatus = h?.status ?? 'unknown';
              const color = STATUS_COLOR[status];
              return (
                <div
                  key={unit.id}
                  onClick={() => mapRef.current?.flyTo([unit.lat, unit.lng], 16, { animate: true, duration: 1 })}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] ${
                    status === 'down'    ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10' :
                    status === 'up'     ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-900/5' :
                    'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  {/* Animated status dot */}
                  <div className="relative flex-shrink-0 w-3 h-3">
                    <div className={`w-3 h-3 rounded-full ${status === 'up' ? 'animate-pulse' : ''}`} style={{ backgroundColor: color }} />
                    {status === 'down' && <div className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ backgroundColor: color }} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">{unit.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[8px] font-black uppercase tracking-wider" style={{ color }}>{STATUS_LABEL[status]}</span>
                      {h?.latencyMs != null && status === 'up' && <span className="text-[8px] text-slate-400 font-bold">{h.latencyMs}ms</span>}
                      {status === 'down' && (h?.consecutiveFails ?? 0) > 1 && <span className="text-[8px] text-red-500 font-black">{h!.consecutiveFails}× fail</span>}
                    </div>
                  </div>

                  {status === 'up'      && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                  {status === 'down'    && <AlertCircle  size={14} className="text-red-500 flex-shrink-0 animate-pulse" />}
                  {(status === 'unknown' || status === 'checking') && <Clock size={14} className="text-slate-400 flex-shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Last probe timestamp */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Last Probe</span>
            <div className="flex items-center gap-1.5">
              <RefreshCw size={8} className={`text-slate-400 ${isProbing ? 'animate-spin' : ''}`} />
              <span className="text-[8px] font-bold text-slate-400">{lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Field agents */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 soft-shadow flex flex-col overflow-hidden" style={{ maxHeight: 260 }}>
          <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl"><Users size={14} className="text-red-600" /></div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Field Agents</h3>
            </div>
            <div className={`w-2 h-2 rounded-full ${activeUserIds.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-2">
            {activeUserIds.length === 0 && <p className="text-[10px] text-slate-400 italic text-center py-4">No live telemetry detected.</p>}
            {activeUserIds.map(uid => {
              const user = users.find(u => u.id === uid);
              const isSelected = selectedUser === uid;
              return (
                <button key={uid} onClick={() => setSelectedUser(isSelected ? null : uid)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isSelected ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white shadow-lg scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-red-300'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${isSelected ? 'bg-[#E31E24] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{user?.name.charAt(0)}</div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={`text-xs font-black truncate ${isSelected ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-white'}`}>{user?.name}</p>
                    <p className={`text-[8px] font-bold uppercase tracking-widest truncate ${isSelected ? 'text-white/60 dark:text-slate-400' : 'text-slate-400'}`}>{user?.department}</p>
                  </div>
                  <Activity size={11} className={`flex-shrink-0 animate-pulse ${isSelected ? 'text-white dark:text-slate-700' : 'text-emerald-500'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-300 dark:border-slate-800 overflow-hidden relative shadow-2xl" style={{ minHeight: 500 }}>
        <div ref={mapContainerRef} className="absolute inset-0 z-0" />

        {/* Controls */}
        <div className="absolute bottom-10 right-10 z-10 flex flex-col gap-3">
          <button onClick={() => { refreshGpsLogs(); probeAllUnits(); }} className="p-4 bg-white dark:bg-slate-800 text-emerald-600 rounded-2xl shadow-2xl border-2 border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all" title="Refresh GPS + re-probe POPs">
            <RefreshCw size={22} className={isProbing ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => mapRef.current?.setView([units[0]?.lat || 23.8103, units[0]?.lng || 90.4125], 13)} className="p-4 bg-white dark:bg-slate-800 text-red-600 rounded-2xl shadow-2xl border-2 border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all group">
            <Target size={22} className="group-hover:rotate-45 transition-transform" />
          </button>
          <button onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() || 13) + 1)} className="p-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl shadow-2xl border-2 border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all">
            <Plus size={22} />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute top-6 left-6 z-10 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-xl hidden sm:block">
          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Legend</p>
          <div className="space-y-1.5">
            {[
              { dot: 'bg-emerald-500', label: 'POP Online', pulse: true },
              { dot: 'bg-red-500',     label: 'POP Offline', pulse: false },
              { dot: 'bg-slate-400',   label: 'Unknown',     pulse: false },
              { dot: 'bg-[#E31E24]',   label: 'Field Agent', pulse: false },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                <div className={`w-2.5 h-2.5 rounded-full ${l.dot} ${l.pulse ? 'animate-pulse' : ''}`} />
                {l.label}
              </div>
            ))}
          </div>
        </div>

        {/* Probe status badge */}
        <div className="absolute top-6 right-6 z-10 flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg">
          <div className={`w-1.5 h-1.5 rounded-full ${isProbing ? 'bg-amber-400 animate-pulse' : downCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            {popUnits.length === 0 ? 'No POPs' : isProbing ? 'Probing…' : downCount > 0 ? `${downCount} POP down` : 'All clear'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;
