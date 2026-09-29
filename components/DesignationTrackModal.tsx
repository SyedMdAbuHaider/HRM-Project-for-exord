// components/DesignationTrackModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One-time popup shown after login when designationTrack is not yet set.
// Saves the choice to Supabase immediately so it never shows again.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { DesignationTrack, resolveDesignationFromSalary } from '../designationConstants';

interface Props {
  userName: string;
  salary: number;
  onConfirm: (track: DesignationTrack, designation: string | null) => Promise<void>;
}

export const DesignationTrackModal: React.FC<Props> = ({ userName, salary, onConfirm }) => {
  const [selected, setSelected] = useState<DesignationTrack | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = selected ? resolveDesignationFromSalary(selected, salary) : null;

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    await onConfirm(selected, preview);
    setSaving(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, padding: '40px 44px',
        maxWidth: 480, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        textAlign: 'center',
      }}>
        {/* Header */}
        <div style={{ fontSize: 36, marginBottom: 8 }}>👋</div>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#111' }}>
          Welcome, {userName}!
        </h2>
        <p style={{ margin: '0 0 28px', color: '#555', fontSize: 14, lineHeight: 1.6 }}>
          We need to know your career track <strong>once</strong> so we can assign your
          designation automatically from your salary. This won't be asked again.
        </p>

        {/* Track cards */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          {(['EXECUTIVE', 'TECHNICIAN'] as DesignationTrack[]).map(track => {
            const active = selected === track;
            return (
              <button
                key={track}
                onClick={() => setSelected(track)}
                style={{
                  flex: 1, padding: '18px 10px', borderRadius: 12, cursor: 'pointer',
                  border: active ? '2.5px solid #4f46e5' : '2px solid #e5e7eb',
                  background: active ? '#eef2ff' : '#fafafa',
                  transition: 'all .18s',
                  outline: 'none',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>
                  {track === 'EXECUTIVE' ? '🏢' : '🔧'}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: active ? '#4f46e5' : '#222' }}>
                  {track === 'EXECUTIVE' ? 'Executive' : 'Technician'}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  {track === 'EXECUTIVE'
                    ? 'Officer · Manager · GM track'
                    : 'Technician · Coordinator · Manager track'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview */}
        {selected && (
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10,
            padding: '12px 16px', marginBottom: 22, fontSize: 14,
          }}>
            {preview
              ? <>Based on your current salary, your designation will be set to{' '}
                  <strong style={{ color: '#16a34a' }}>{preview}</strong>.</>
              : <>Your salary is outside the defined tiers for this track. An admin will assign
                  your designation manually.</>
            }
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: selected ? '#4f46e5' : '#d1d5db',
            color: '#fff', fontWeight: 700, fontSize: 15, border: 'none',
            cursor: selected ? 'pointer' : 'default',
            transition: 'background .18s',
          }}
        >
          {saving ? 'Saving…' : 'Confirm & Continue'}
        </button>

        <p style={{ fontSize: 11, color: '#bbb', marginTop: 14 }}>
          You can contact your administrator if you selected the wrong track.
        </p>
      </div>
    </div>
  );
};
