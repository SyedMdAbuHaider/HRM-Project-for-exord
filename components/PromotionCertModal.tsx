// components/PromotionCertModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shown when an employee's salary crosses into a higher designation tier.
// Includes a printable / downloadable certificate.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef } from 'react';

interface Props {
  employeeName: string;
  previousDesignation: string;
  newDesignation: string;
  effectiveDate?: string; // YYYY-MM-DD, defaults to today
  onClose: () => void;
}

export const PromotionCertModal: React.FC<Props> = ({
  employeeName,
  previousDesignation,
  newDesignation,
  effectiveDate,
  onClose,
}) => {
  const certRef = useRef<HTMLDivElement>(null);

  const today = effectiveDate || new Date().toISOString().split('T')[0];
  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-');
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
  };

  const handlePrint = () => {
    const content = certRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Promotion Certificate</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;600&display=swap');
        body { margin: 0; padding: 0; background: #fff; }
        * { box-sizing: border-box; }
      </style>
      </head><body>${content}</body></html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  const certStyle: React.CSSProperties = {
    background: '#fffdf5',
    border: '8px double #b8962e',
    borderRadius: 4,
    padding: '48px 56px',
    textAlign: 'center',
    fontFamily: "'Playfair Display', serif",
    maxWidth: 680,
    margin: '0 auto',
    position: 'relative',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: 20,
      overflowY: 'auto',
    }}>
      {/* Confetti header */}
      <div style={{ fontSize: 48, marginBottom: 12, textAlign: 'center' }}>🎉🎊🏆</div>
      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>
        Congratulations, {employeeName.split(' ')[0]}!
      </h1>
      <p style={{ color: '#d1d5db', marginBottom: 24, textAlign: 'center', fontSize: 15 }}>
        You've been promoted to a new designation!
      </p>

      {/* Certificate */}
      <div ref={certRef} style={certStyle}>
        {/* Corner ornaments */}
        {['top:12px;left:12px', 'top:12px;right:12px', 'bottom:12px;left:12px', 'bottom:12px;right:12px'].map((pos, i) => (
          <div key={i} style={{
            position: 'absolute',
            ...Object.fromEntries(pos.split(';').map(p => p.split(':'))),
            fontSize: 20, color: '#b8962e', lineHeight: 1,
          }}>✦</div>
        ))}

        <div style={{ fontSize: 13, letterSpacing: 4, color: '#b8962e', textTransform: 'uppercase', marginBottom: 8 }}>
          Exord Online
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
          Certificate of Promotion
        </div>
        <div style={{ width: 80, height: 2, background: '#b8962e', margin: '16px auto', borderRadius: 2 }} />

        <p style={{ fontSize: 14, color: '#555', fontFamily: 'Inter, sans-serif', marginBottom: 20 }}>
          This is to certify that
        </p>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#111', marginBottom: 4 }}>
          {employeeName}
        </div>
        <p style={{ fontSize: 14, color: '#555', fontFamily: 'Inter, sans-serif', marginBottom: 20, marginTop: 8 }}>
          has been promoted from
        </p>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 16,
          background: '#fff8e7', border: '1px solid #f0d080',
          borderRadius: 8, padding: '12px 24px', marginBottom: 24,
        }}>
          <span style={{ fontSize: 15, color: '#888', fontFamily: 'Inter, sans-serif', textDecoration: 'line-through' }}>
            {previousDesignation}
          </span>
          <span style={{ fontSize: 20, color: '#b8962e' }}>→</span>
          <span style={{ fontSize: 17, color: '#1a1a1a', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
            {newDesignation}
          </span>
        </div>

        <p style={{ fontSize: 13, color: '#777', fontFamily: 'Inter, sans-serif', marginBottom: 32 }}>
          Effective from{' '}
          <strong style={{ color: '#333' }}>{fmtDate(today)}</strong>
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 120, height: 1, background: '#333', marginBottom: 6 }} />
            <div style={{ fontSize: 12, color: '#555', fontFamily: 'Inter, sans-serif' }}>HR Department</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 120, height: 1, background: '#333', marginBottom: 6 }} />
            <div style={{ fontSize: 12, color: '#555', fontFamily: 'Inter, sans-serif' }}>General Manager</div>
          </div>
        </div>

        <div style={{ marginTop: 28, fontSize: 11, color: '#bbb', fontFamily: 'Inter, sans-serif', letterSpacing: 1 }}>
          EXORD ONLINE HRM — Auto-generated on {fmtDate(today)}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          onClick={handlePrint}
          style={{
            padding: '12px 28px', borderRadius: 8, fontWeight: 700,
            fontSize: 14, border: 'none', cursor: 'pointer',
            background: '#b8962e', color: '#fff',
          }}
        >
          🖨️ Print / Download Certificate
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '12px 28px', borderRadius: 8, fontWeight: 600,
            fontSize: 14, border: '1.5px solid #ffffff55',
            background: 'transparent', color: '#fff', cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};
