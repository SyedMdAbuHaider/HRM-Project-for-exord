import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  DesignationTrack,
  EXECUTIVE_DESIGNATIONS,
  TECHNICIAN_DESIGNATIONS,
  resolveDesignationFromSalary,
} from '../designationConstants';

interface EmpRow {
  id: string;
  name: string;
  email: string;
  base_salary: number;
  designation_track: DesignationTrack | null;
  designation: string | null;
}

const titlesFor = (track: DesignationTrack | null) =>
  track === 'EXECUTIVE'
    ? EXECUTIVE_DESIGNATIONS.map(d => d.title)
    : track === 'TECHNICIAN'
    ? TECHNICIAN_DESIGNATIONS.map(d => d.title)
    : [];

export const DesignationAdminView: React.FC = () => {
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [flash, setFlash] = useState<{ id: string; ok: boolean } | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<EmpRow>>>({});
  const [certQueue, setCertQueue] = useState<{ name: string; desig: string }[]>([]);
  const [certIndex, setCertIndex] = useState(0);
  const [showingCert, setShowingCert] = useState(false);

  useEffect(() => {
    supabase
      .from('users')
      .select('id,name,email,base_salary,designation_track,designation')
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) setEmployees(data as EmpRow[]);
        setLoading(false);
      });
  }, []);

  const get = (emp: EmpRow, key: keyof EmpRow) =>
    (edits[emp.id]?.[key] as any) ?? emp[key];

  const setEdit = (id: string, key: keyof EmpRow, val: any) =>
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const handleTrackChange = (emp: EmpRow, track: DesignationTrack) => {
    setEdit(emp.id, 'designation_track', track);
    const auto = resolveDesignationFromSalary(track, emp.base_salary);
    setEdit(emp.id, 'designation', auto || '');
  };

  const save = async (emp: EmpRow) => {
    const patch = edits[emp.id];
    if (!patch) return;
    setSaving(emp.id);
    const { error } = await supabase
      .from('users')
      .update({
        designation_track: patch.designation_track ?? emp.designation_track,
        designation: patch.designation ?? emp.designation,
      })
      .eq('id', emp.id);
    if (!error) {
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, ...patch } : e));
      setEdits(prev => { const n = { ...prev }; delete n[emp.id]; return n; });
      setFlash({ id: emp.id, ok: true });
    } else {
      setFlash({ id: emp.id, ok: false });
    }
    setSaving(null);
    setTimeout(() => setFlash(null), 2000);
  };

  const recalcAll = async () => {
    if (!window.confirm('Auto-recalculate designations for ALL employees with a track set?')) return;
    setSaving('__all__');
    const updates = employees.filter(e => e.designation_track).map(e => ({
      id: e.id,
      designation: resolveDesignationFromSalary(e.designation_track!, e.base_salary) || e.designation,
    }));
    for (const u of updates) {
      await supabase.from('users').update({ designation: u.designation }).eq('id', u.id);
    }
    const { data } = await supabase
      .from('users')
      .select('id,name,email,base_salary,designation_track,designation')
      .order('name');
    if (data) setEmployees(data as EmpRow[]);
    setSaving(null);
  };

  const fireInitialCerts = () => {
    const eligible = employees.filter(e => e.designation_track && e.designation);
    if (eligible.length === 0) {
      alert('No employees with designations found. Run Recalc All first.');
      return;
    }
    if (!window.confirm('Issue designation certificates to ' + eligible.length + ' employees?')) return;
    setCertQueue(eligible.map(e => ({ name: e.name, desig: e.designation! })));
    setCertIndex(0);
    setShowingCert(true);
  };

  const nextCert = () => {
    const next = certIndex + 1;
    if (next < certQueue.length) {
      setCertIndex(next);
    } else {
      setShowingCert(false);
      setCertQueue([]);
      setCertIndex(0);
    }
  };

  const filtered = employees.filter(e =>
    (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const noTrack = employees.filter(e => !e.designation_track).length;
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading employees...</div>
  );

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Designation Management</h2>
        <p style={{ margin: '6px 0 0', color: '#666', fontSize: 14 }}>Override or fix employee career tracks and designations.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 20}}>
        {[
          { label: 'Total', val: employees.length, color: '#4f46e5' },
          { label: 'No Track', val: noTrack, color: noTrack > 0 ? '#dc2626' : '#16a34a' },
          { label: 'Executive', val: employees.filter(e => e.designation_track === 'EXECUTIVE').length, color: '#0891b2' },
          { label: 'Technician', val: employees.filter(e => e.designation_track === 'TECHNICIAN').length, color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{flex: 1, background: '#f8f9fa', borderRadius: 10, padding: '14px 16px', borderLeft: '4px solid ' + s.color }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e5e7eb', outline: 'none' }}
        />
        <button onClick={recalcAll} disabled={saving === '__all__'}
          style={{ padding: '9px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {saving === '__all__' ? 'Recalculating...' : 'Recalc All from Salary'}
        </button>
        <button onClick={fireInitialCerts}
          style={{ padding: '9px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Issue Initial Certificates
        </button>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Employee', 'Salary', 'Career Track', 'Designation', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#555', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => {
              const track = get(emp, 'designation_track') as DesignationTrack | null;
              const desig = get(emp, 'designation') as string | null;
              const isDirty = !!edits[emp.id];
              const isSaving = saving === emp.id;
              const f = flash?.id === emp.id;
              return (
                <tr key={emp.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#111' }}>{emp.name}</div>
                    <div style={{ color: '#888', fontSize: 11 }}>{emp.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#333', fontWeight: 600 }}>
                    {(emp.base_salary || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select value={track || ''} onChange={e => handleTrackChange(emp, e.target.value as DesignationTrack)}
                      style={{ padding: '6px 10px', borderRadius: 6, fontSize: 13, border: '1.5px solid ' + (track ? '#e5e7eb' : '#fca5a5'), background: !track ? '#fff5f5' : '#fff', outline: 'none', cursor: 'pointer', minWidth: 130 }}>
                      <option value="">Not set</option>
                      <option value="EXECUTIVE">Executive</option>
                      <option value="TECHNICIAN">Technician</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {track ? (
                      <select value={desig || ''} onChange={e => setEdit(emp.id, 'designation', e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, border: '1.5px solid #e5e7eb', background: '#fff', outline: 'none', cursor: 'pointer', maxWidth: 240 }}>
                        <option value="">Manual override</option>
                        {titlesFor(track).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: '#bbb', fontSize: 12 }}>Set track first</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {f ? (
                      <span style={{ fontSize: 18 }}>{flash!.ok ? 'Saved' : 'Error'}</span>
                    ) : (
                      <button onClick={() => save(emp)} disabled={!isDirty || isSaving}
                        style={{ padding: '6px 14px', borderRadius: 6, fontWeight: 600, fontSize: 12, border: 'none', cursor: isDirty ? 'pointer' : 'default', background: isDirty ? '#4f46e5' : '#e5e7eb', color: isDirty ? '#fff' : '#aaa' }}>
                        {isSaving ? '...' : 'Save'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#bbb' }}>No employees found.</div>}
      </div>

      {showingCert && certQueue[certIndex] && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎓🏆🎉</div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Designation Certificate</h2>
          <p style={{ color: '#9ca3af', marginBottom: 20, fontSize: 13 }}>{certIndex + 1} of {certQueue.length}</p>

          <div id="cert-print-area" style={{ background: '#fffdf5', border: '8px double #E31E24', borderRadius: 4, padding: '40px 52px', maxWidth: 640, width: '100%', textAlign: 'center', fontFamily: 'Georgia, serif', position: 'relative' }}>
            <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6 }}><span style={{ color: '#E31E24', fontWeight: 900 }}>EXORD</span><span style={{ color: '#111', fontWeight: 900 }}> ONLINE</span></div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Certificate of Designation</div>
            <div style={{ width: 70, height: 2, background: '#E31E24', margin: '14px auto' }} />
            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter, sans-serif', marginBottom: 16 }}>This is to certify that</p>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#111', marginBottom: 8 }}>{certQueue[certIndex].name}</div>
            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter, sans-serif', marginBottom: 12 }}>has been officially designated as</p>
            <div style={{ background: '#fff5f5', border: '1px solid #E31E24', borderRadius: 8, padding: '14px 24px', marginBottom: 24, display: 'inline-block' }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#E31E24', fontFamily: 'Inter, sans-serif' }}>{certQueue[certIndex].desig}</span>
            </div>
            <p style={{ fontSize: 12, color: '#777', fontFamily: 'Inter, sans-serif', marginBottom: 28 }}>Effective from <strong>{today}</strong></p>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16 }}>
              <div style={{ textAlign: 'center' }}><div style={{ width: 110, height: 1, background: '#333', marginBottom: 5 }} /><div style={{ fontSize: 11, color: '#555', fontFamily: 'Inter, sans-serif' }}>HR Department</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ width: 110, height: 1, background: '#333', marginBottom: 5 }} /><div style={{ fontSize: 11, color: '#555', fontFamily: 'Inter, sans-serif' }}>General Manager</div></div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => window.print()}
              style={{ padding: '11px 24px', borderRadius: 8, fontWeight: 700, fontSize: 13, background: '#E31E24', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Print Certificate
            </button>
            <button onClick={nextCert}
              style={{ padding: '11px 24px', borderRadius: 8, fontWeight: 700, fontSize: 13, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {certIndex + 1 < certQueue.length ? 'Next (' + (certQueue.length - certIndex - 1) + ' remaining)' : 'Done'}
            </button>
            <button onClick={() => { setShowingCert(false); setCertQueue([]); setCertIndex(0); }}
              style={{ padding: '11px 24px', borderRadius: 8, fontWeight: 600, fontSize: 13, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer' }}>
              Skip All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignationAdminView;
