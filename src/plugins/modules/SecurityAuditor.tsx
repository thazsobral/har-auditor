import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { SecuritySeverity, SecurityIssue } from '../../types/har.ts';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';

export const SecurityAuditor: React.FC<ToolPluginContext> = ({
  entries,
  metrics,
  onSelectEntry,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<SecuritySeverity | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allIssues = useMemo(() => {
    const list: Array<SecurityIssue & { url: string; method: string; index: number }> = [];
    entries.forEach((e) => {
      e.securityIssues.forEach((issue) => {
        list.push({
          ...issue,
          url: e.request.url,
          method: e.request.method,
          index: e.index,
        });
      });
    });
    return list;
  }, [entries]);

  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      if (selectedSeverity !== 'all' && issue.severity !== selectedSeverity) return false;
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) return false;
      return true;
    });
  }, [allIssues, selectedSeverity, selectedCategory]);

  const securityScore = useMemo(() => {
    const s = metrics.securitySummary;
    let score = 100;
    score -= s.critical * 25;
    score -= s.high * 15;
    score -= s.medium * 5;
    score -= s.low * 2;
    return Math.max(0, Math.min(100, score));
  }, [metrics.securitySummary]);

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { grade: 'A', text: 'Excelente postura de segurança', color: 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30' };
    if (score >= 75) return { grade: 'B', text: 'Boa, com vulnerabilidades menores', color: 'text-cyan-700 dark:text-cyan-400 border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/30' };
    if (score >= 50) return { grade: 'C', text: 'Atenção: riscos identificados', color: 'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/30' };
    return { grade: 'F', text: 'Crítico: falhas graves detectadas', color: 'text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/30' };
  };

  const scoreBadge = getScoreBadge(securityScore);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors">
      {/* Top Audit Score & Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Score Card */}
        <div className={`p-4 rounded-lg border ${scoreBadge.color} flex items-center justify-between shadow-xs`}>
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">Postura de Segurança</div>
            <div className="text-3xl font-extrabold font-mono mt-1 text-zinc-900 dark:text-zinc-100">{securityScore} <span className="text-base text-zinc-500 dark:text-zinc-400 font-normal">/ 100</span></div>
            <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">{scoreBadge.text}</div>
          </div>
          <div className="text-4xl font-black font-mono px-3 py-1 rounded border border-current">
            {scoreBadge.grade}
          </div>
        </div>

        {/* Critical Alerts */}
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'critical' ? 'all' : 'critical')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-xs ${
            selectedSeverity === 'critical'
              ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-500 shadow-md ring-1 ring-rose-500'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-800/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-medium uppercase tracking-wider">
            <span>Crítico</span>
            <ShieldAlert size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {metrics.securitySummary.critical}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Exposição direta de chaves ou dados</div>
        </div>

        {/* High Alerts */}
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'high' ? 'all' : 'high')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-xs ${
            selectedSeverity === 'high'
              ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 shadow-md ring-1 ring-amber-500'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-800/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider">
            <span>Alto</span>
            <AlertTriangle size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {metrics.securitySummary.high}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">HTTP puro, cookies inseguros, CORS livre</div>
        </div>

        {/* Medium & Low */}
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'medium' ? 'all' : 'medium')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-xs ${
            selectedSeverity === 'medium'
              ? 'bg-sky-100 dark:bg-sky-950/60 border-sky-500 shadow-md ring-1 ring-sky-500'
              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-sky-400 dark:hover:border-sky-800/80'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-sky-700 dark:text-sky-400 font-medium uppercase tracking-wider">
            <span>Médio & Baixo</span>
            <Info size={16} />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-2">
            {metrics.securitySummary.medium + metrics.securitySummary.low}
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Headers CSP, HSTS, X-Content-Type ausentes</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Severidade:</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`px-2.5 py-1 rounded text-xs uppercase tracking-wide font-medium transition ${
                selectedSeverity === sev
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {sev === 'all' ? 'Todas' : sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Categoria:</span>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'leakage', label: 'Vazamentos' },
            { id: 'transport', label: 'Transporte' },
            { id: 'headers', label: 'Headers' },
            { id: 'auth', label: 'Cookies/Auth' },
            { id: 'cors', label: 'CORS' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded text-xs transition ${
                selectedCategory === cat.id
                  ? 'bg-zinc-800 dark:bg-zinc-700 text-white'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1">
          <span className="font-semibold uppercase tracking-wider">
            Vulnerabilidades e Diagnósticos Identificados ({filteredIssues.length})
          </span>
          <span>Clique em um alerta para inspecionar no tráfego</span>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="p-12 text-center border border-zinc-200 dark:border-zinc-800/80 rounded-lg bg-zinc-50 dark:bg-zinc-900/20 text-zinc-500 dark:text-zinc-400">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
            <p className="font-semibold text-zinc-800 dark:text-zinc-200">Nenhuma inconformidade encontrada para este filtro.</p>
            <p className="text-xs text-zinc-500 mt-1">O arquivo HAR não apresentou ocorrências nessa categoria.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const sevBadgeClass = {
              critical: 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
              high: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
              medium: 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
              low: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700',
              info: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-800',
            }[issue.severity];

            return (
              <div
                key={issue.id}
                onClick={() => onSelectEntry(issue.entryId)}
                className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 hover:border-cyan-400 dark:hover:border-zinc-700 cursor-pointer transition space-y-2 group shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${sevBadgeClass}`}>
                      {issue.severity}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{issue.title}</span>
                  </div>
                  <span className="text-xs text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-medium">
                    Inspecionar Endpoint <ChevronRight size={13} />
                  </span>
                </div>

                <div className="font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded border border-zinc-200 dark:border-zinc-900">
                  <span className="text-cyan-700 dark:text-cyan-400 font-bold mr-2">{issue.method}</span>
                  {issue.url}
                </div>

                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{issue.description}</p>

                {issue.evidence && (
                  <div className="text-xs font-mono text-amber-800 dark:text-amber-300/90 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-2 rounded break-all">
                    Evidência extraída: {issue.evidence}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800/60 text-xs">
                  <span className="text-zinc-500 font-mono">{issue.cwe || 'Auditoria Automatizada'}</span>
                  <div className="text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                    <strong>Correção:</strong> {issue.recommendation}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
