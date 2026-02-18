
import React, { useState } from 'react';
import { useHRM } from '../store';
import { ShieldAlert, RefreshCw, CheckCircle, XCircle, BrainCircuit } from 'lucide-react';
import { analyzeSecurityLogs } from '../geminiService';
import { formatDate } from '../utils';

const SecurityLogs: React.FC = () => {
  const { auditLogs } = useHRM();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const handleDeepAnalysis = async () => {
    setAnalyzing(true);
    const result = await analyzeSecurityLogs(auditLogs.slice(0, 50));
    setAnalysisResult(result);
    setAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Security & Protocol Audit</h2>
          <p className="text-slate-500 text-sm font-medium">Monitoring Exord Online infrastructure and workforce compliance.</p>
        </div>
        <button
          onClick={handleDeepAnalysis}
          disabled={analyzing}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-red-200 font-bold text-sm"
        >
          {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
          AI Protocol Auditor
        </button>
      </div>

      {analysisResult && (
        <div className={`p-8 rounded-3xl border shadow-xl ${
          analysisResult.riskLevel === 'High' ? 'bg-red-50 border-red-200' : 
          analysisResult.riskLevel === 'Medium' ? 'bg-amber-50 border-amber-200' : 
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start gap-6">
            <div className={`p-4 rounded-2xl ${
              analysisResult.riskLevel === 'High' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
            }`}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">AI Security Analysis - Level: {analysisResult.riskLevel}</h3>
                <button onClick={() => setAnalysisResult(null)} className="text-slate-400 hover:text-slate-600 p-2">&times;</button>
              </div>
              <p className="text-sm text-slate-700 mb-6 leading-relaxed font-medium">{analysisResult.summary}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/60 p-5 rounded-2xl border border-white">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">Protocol Anomalies</h4>
                  <ul className="text-xs space-y-3">
                    {analysisResult.anomalies.map((a: any, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 flex-shrink-0"></span>
                        <div>
                          <p className="font-black text-slate-800 uppercase tracking-tight text-[11px] mb-0.5">{a.threatType}</p>
                          <p className="text-slate-500 font-medium">{a.description}</p>
                        </div>
                      </li>
                    ))}
                    {analysisResult.anomalies.length === 0 && <li className="text-slate-400 italic">No significant deviations detected in recent packets.</li>}
                  </ul>
                </div>
                <div className="bg-white/60 p-5 rounded-2xl border border-white">
                  <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">Expert Countermeasures</h4>
                  <ul className="text-xs space-y-3">
                    {analysisResult.recommendations.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="font-medium text-slate-600">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-[0.2em]">
            <tr>
              <th className="px-8 py-5">Sequence Time</th>
              <th className="px-8 py-5">System Identity</th>
              <th className="px-8 py-5">Operational Action</th>
              <th className="px-8 py-5">Risk Matrix</th>
              <th className="px-8 py-5">Data Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {auditLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-8 py-5 text-[11px] font-bold text-slate-400">{formatDate(log.timestamp)}</td>
                <td className="px-8 py-5">
                  <div className="text-sm font-black text-slate-900 tracking-tight">{log.userName}</div>
                  <div className="text-[9px] text-slate-400 font-bold">{log.userId}</div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:bg-red-50 group-hover:text-red-700 transition-colors">{log.action}</span>
                </td>
                <td className="px-8 py-5">
                  <span className={`flex items-center gap-1.5 text-[10px] font-black tracking-widest ${
                    log.severity === 'CRITICAL' ? 'text-red-600' :
                    log.severity === 'HIGH' ? 'text-orange-600' :
                    log.severity === 'MEDIUM' ? 'text-amber-600' : 'text-green-600'
                  }`}>
                    {log.severity === 'CRITICAL' && <XCircle size={14} />}
                    {log.severity}
                  </span>
                </td>
                <td className="px-8 py-5 text-xs text-slate-500 font-medium leading-relaxed">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SecurityLogs;
