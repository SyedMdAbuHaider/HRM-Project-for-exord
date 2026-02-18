
import React, { useEffect, useRef, useState } from 'react';
import { useHRM } from '../store';
import L from 'leaflet';
import { Map as MapIcon, Users, Target, Crosshair, MapPinned, Activity, RefreshCw } from 'lucide-react';
import { OFFICE_CONFIG } from '../constants';

const LiveTracking: React.FC = () => {
  const { gpsLogs, users } = useHRM();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, { 
      zoomControl: false,
      attributionControl: false
    }).setView([OFFICE_CONFIG.LOCATION.lat, OFFICE_CONFIG.LOCATION.lng], 13);
    
    L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(mapRef.current);

    // HQ Geofence
    L.circle([OFFICE_CONFIG.LOCATION.lat, OFFICE_CONFIG.LOCATION.lng], {
      color: '#E31E24',
      fillColor: '#E31E24',
      fillOpacity: 0.1,
      radius: OFFICE_CONFIG.RADIUS_METERS,
      weight: 2,
      dashArray: '5, 10'
    }).addTo(mapRef.current).bindPopup('Exord HQ Sector');

    // HQ Marker
    L.marker([OFFICE_CONFIG.LOCATION.lat, OFFICE_CONFIG.LOCATION.lng], {
      icon: L.divIcon({
        className: 'hq-marker',
        html: `<div class="w-6 h-6 bg-white dark:bg-slate-900 border-2 border-red-600 rounded-lg shadow-lg flex items-center justify-center"><div class="w-2 h-2 bg-red-600 rounded-full"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(mapRef.current);

    // Fix map size on container resize
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Filter to latest log per user
    const latestPositions: { [key: string]: any } = {};
    gpsLogs.forEach(log => {
      // Only keep the most recent log for each user
      if (!latestPositions[log.userId] || new Date(log.timestamp) > new Date(latestPositions[log.userId].timestamp)) {
        latestPositions[log.userId] = log;
      }
    });

    Object.values(latestPositions).forEach(pos => {
      const user = users.find(u => u.id === pos.userId);
      if (!user) return;
      
      const latlng: [number, number] = [pos.lat, pos.lng];

      if (markersRef.current[pos.userId]) {
        markersRef.current[pos.userId].setLatLng(latlng);
      } else {
        const marker = L.marker(latlng, {
          icon: L.divIcon({
            className: 'user-telemetry-marker',
            html: `<div class="relative w-10 h-10 animate-[bounce_2s_infinite]">
                     <div class="absolute inset-0 bg-red-600 rounded-2xl rotate-45 shadow-lg border-2 border-white dark:border-slate-800"></div>
                     <div class="absolute inset-0 flex items-center justify-center text-white font-black text-xs z-10">${user.name.charAt(0)}</div>
                     <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-600/20 blur-sm rounded-full"></div>
                   </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          })
        })
        .addTo(mapRef.current!)
        .bindPopup(`<div class="p-2">
                      <p class="font-black text-slate-900 uppercase tracking-tight mb-1">${user.name}</p>
                      <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${user.department}</p>
                      <div class="mt-2 h-px bg-slate-100"></div>
                      <p class="mt-2 text-[8px] font-mono text-slate-400">Lat: ${pos.lat.toFixed(5)}<br/>Lng: ${pos.lng.toFixed(5)}</p>
                    </div>`);
        markersRef.current[pos.userId] = marker;
      }

      // Auto-pan if selected
      if (selectedUser === pos.userId) {
        mapRef.current?.panTo(latlng, { animate: true });
      }
    });

    setLastUpdate(new Date());
  }, [gpsLogs, users, selectedUser]);

  const activeUserIds = Array.from(new Set(gpsLogs.map(l => l.userId)));

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8 animate-[fadeIn_0.5s_ease-out]">
      {/* Sidebar List */}
      <div className="w-full lg:w-80 flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-slate-300 dark:border-slate-800 soft-shadow overflow-hidden flex flex-col max-h-[500px] lg:max-h-full">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl">
                <Users size={18} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Active Nodes</h3>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>

          <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
            {activeUserIds.length === 0 && (
              <div className="text-center py-12 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">No live telemetry detected in this sector.</p>
              </div>
            )}
            {activeUserIds.map(uid => {
               const user = users.find(u => u.id === uid);
               const isSelected = selectedUser === uid;
               return (
                 <button 
                  key={uid}
                  onClick={() => setSelectedUser(isSelected ? null : uid)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border-2 group ${
                    isSelected 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xl scale-[1.02]' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-600/30'
                  }`}
                 >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-colors ${
                      isSelected ? 'bg-[#E31E24] text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {user?.name.charAt(0)}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                       <p className="text-xs font-black truncate">{user?.name}</p>
                       <p className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isSelected ? 'text-white/60 dark:text-slate-400' : 'text-slate-400'}`}>{uid}</p>
                    </div>
                    <Activity size={12} className={`${isSelected ? 'text-white' : 'text-emerald-500'} animate-pulse`} />
                 </button>
               );
            })}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
             <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sync Status</span>
                <div className="flex items-center gap-2">
                   <RefreshCw size={10} className="text-slate-400 animate-spin-slow" />
                   <span className="text-[9px] font-bold text-slate-400 uppercase">{lastUpdate.toLocaleTimeString()}</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Map View */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-300 dark:border-slate-800 overflow-hidden relative shadow-2xl min-h-[500px] lg:min-h-0">
        <div ref={mapContainerRef} className="h-full w-full z-0" />
        
        {/* Controls Overlay */}
        <div className="absolute bottom-10 right-10 z-10 flex flex-col gap-3">
           <button 
             onClick={() => mapRef.current?.setView([OFFICE_CONFIG.LOCATION.lat, OFFICE_CONFIG.LOCATION.lng], 16)} 
             className="p-4 bg-white dark:bg-slate-800 text-red-600 rounded-2xl shadow-2xl border-2 border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all group"
           >
              <Target size={24} className="group-hover:rotate-45 transition-transform" />
           </button>
           <button 
             onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() || 13) + 1)}
             className="p-4 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl shadow-2xl border-2 border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all"
           >
              <Plus size={24} />
           </button>
        </div>

        {/* Legend */}
        <div className="absolute top-6 left-6 z-10 p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border-2 border-slate-300 dark:border-slate-800 shadow-xl hidden sm:block">
           <div className="space-y-2">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                 <div className="w-2 h-2 rounded-full bg-red-600"></div> HQ Perimeter
              </div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
                 <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Signal Active
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const Plus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export default LiveTracking;
