
import React, { useEffect, useRef } from 'react';
import { useHRM } from '../store';
import L from 'leaflet';

const LiveTracking: React.FC = () => {
  const { gpsLogs, users } = useHRM();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current).setView([40.7128, -74.0060], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Office boundary circle - Red brand color
    L.circle([40.7128, -74.0060], {
      color: '#dc2626',
      fillColor: '#dc2626',
      fillOpacity: 0.1,
      radius: 500
    }).addTo(mapRef.current).bindPopup('Exord HQ (Primary Geo-fence)');

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const latestPositions: { [key: string]: any } = {};
    gpsLogs.forEach(log => {
      latestPositions[log.userId] = log;
    });

    Object.values(latestPositions).forEach(pos => {
      const user = users.find(u => u.id === pos.userId);
      const name = user?.name || 'Unknown';
      
      if (markersRef.current[pos.userId]) {
        markersRef.current[pos.userId].setLatLng([pos.lat, pos.lng]);
      } else {
        const marker = L.marker([pos.lat, pos.lng])
          .addTo(mapRef.current!)
          .bindPopup(`<b>${name}</b><br/>Role: ${user?.department}<br/>Time: ${new Date(pos.timestamp).toLocaleTimeString()}`);
        markersRef.current[pos.userId] = marker;
      }
    });
  }, [gpsLogs, users]);

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Real-time Workforce Intelligence</h2>
          <p className="text-slate-500 text-sm font-medium">Monitoring field engineering deployments and office security.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
            <span className="text-[10px] font-black uppercase text-slate-700 tracking-widest">Secure Uplink Active</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
        <div ref={mapContainerRef} className="h-full w-full z-0" />
        
        <div className="absolute bottom-6 left-6 z-10 bg-slate-950/90 backdrop-blur-md p-5 rounded-2xl shadow-2xl border border-slate-800 pointer-events-none">
          <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 pb-2 border-b border-slate-800">Map Legend</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              <span className="text-slate-300">Exord Headquarters</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="w-3 h-3 rounded-sm bg-red-600/20 border border-red-500/50"></span>
              <span className="text-slate-300">Geo-fenced Perimeter</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span>
              <span className="text-slate-300">Staff Position</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;
