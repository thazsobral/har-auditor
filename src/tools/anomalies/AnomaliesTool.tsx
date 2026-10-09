import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { EnrichedHarEntry } from '../../types/har.ts';
import {
  Activity,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  TrendingDown,
  Sparkles,
  Zap,
  Info,
  CheckCircle2,
  GitCompare,
} from 'lucide-react';

export interface DuplicateCluster {
  id: string;
  method: string;
  url: string;
  count: number;
  timeWindowMs: number;
  wastedBytes: number;
  entries: EnrichedHarEntry[];
  firstStartTime: number;
}

export interface RaceHazard {
  id: string;
  method: string;
  url: string;
  reqA: EnrichedHarEntry;
  reqB: EnrichedHarEntry;
  startDelayMs: number;
  inversionDeltaMs: number;
}

export const AnomaliesTool: React.FC<ToolPluginContext> = ({ entries, onSelectEntry }) => {
  const [activeTab, setActiveTab] = useState<'n_plus_one' | 'race_conditions'>('n_plus_one');
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Algoritmo N+1 Queries / Chamadas Idênticas em Janela de 500ms
  const duplicateClusters = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    // Sort entries chronologically
    const sorted = [...entries].sort(
      (a, b) => new Date(a.startedDateTime).getTime() - new Date(b.startedDateTime).getTime()
    );

    const visited = new Set<string>();
    const clusters: DuplicateCluster[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const base = sorted[i];
      if (visited.has(base.id)) continue;

      const baseTime = new Date(base.startedDateTime).getTime();
      const clusterEntries: EnrichedHarEntry[] = [base];
      visited.add(base.id);

      // Look ahead within 500ms
      for (let j = i + 1; j < sorted.length; j++) {
        const candidate = sorted[j];
        const candidateTime = new Date(candidate.startedDateTime).getTime();

        if (candidateTime - baseTime > 500) {
          break; // outside 500ms window
        }

        if (
          candidate.request.method === base.request.method &&
          candidate.request.url === base.request.url
        ) {
          clusterEntries.push(candidate);
          visited.add(candidate.id);
        }
      }

      if (clusterEntries.length > 1) {
        const lastTime = new Date(
          clusterEntries[clusterEntries.length - 1].startedDateTime
        ).getTime();
        const wasted = clusterEntries
          .slice(1)
          .reduce(
            (sum, e) => sum + (e.response.content?.size || e.response.bodySize || 0),
            0
          );

        clusters.push({
          id: `cluster-${base.id}`,
          method: base.request.method,
          url: base.request.url,
          count: clusterEntries.length,
          timeWindowMs: Math.max(1, lastTime - baseTime),
          wastedBytes: wasted,
          entries: clusterEntries,
          firstStartTime: baseTime,
        });
      }
    }

    return clusters.sort((a, b) => b.count - a.count);
  }, [entries]);

  // 2. Algoritmo de Race Condition (Inversão de Ordem de Chegada)
  const raceHazards = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const hazards: RaceHazard[] = [];
    const sorted = [...entries].sort(
      (a, b) => new Date(a.startedDateTime).getTime() - new Date(b.startedDateTime).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      const reqA = sorted[i];
      const startA = new Date(reqA.startedDateTime).getTime();
      const endA = startA + reqA.time;

      for (let j = i + 1; j < sorted.length; j++) {
        const reqB = sorted[j];
        const startB = new Date(reqB.startedDateTime).getTime();
        const endB = startB + reqB.time;

        // Se B iniciou depois de A ter finalizado completamente, não há sobreposição de concorrência
        if (startB > endA) break;

        // Mesma rota/endpoint alvo
        if (
          reqA.parsedUrl.pathname === reqB.parsedUrl.pathname &&
          reqA.parsedUrl.hostname === reqB.parsedUrl.hostname
        ) {
          // CONDIÇÃO DE CORRIDA: Req A foi despachada antes (startA <= startB),
          // mas Req B terminou ANTES de Req A (endB < endA).
          // Portanto, a resposta desatualizada de A chegará por último no cliente!
          if (endB < endA) {
            hazards.push({
              id: `race-${reqA.id}-${reqB.id}`,
              method: reqA.request.method,
              url: reqA.request.url,
              reqA,
              reqB,
              startDelayMs: startB - startA,
              inversionDeltaMs: Math.round(endA - endB),
            });
          }
        }
      }
    }

    return hazards;
  }, [entries]);

  // Filtered lists
  const filteredClusters = useMemo(() => {
    if (!searchFilter.trim()) return duplicateClusters;
    const q = searchFilter.toLowerCase();
    return duplicateClusters.filter(
      (c) => c.url.toLowerCase().includes(q) || c.method.toLowerCase().includes(q)
    );
  }, [duplicateClusters, searchFilter]);

  const filteredHazards = useMemo(() => {
    if (!searchFilter.trim()) return raceHazards;
    const q = searchFilter.toLowerCase();
    return raceHazards.filter(
      (h) => h.url.toLowerCase().includes(q) || h.method.toLowerCase().includes(q)
    );
  }, [raceHazards, searchFilter]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalDuplicateRequests = useMemo(() => {
    return duplicateClusters.reduce((sum, c) => sum + (c.count - 1), 0);
  }, [duplicateClusters]);

  const totalWastedBytes = useMemo(() => {
    return duplicateClusters.reduce((sum, c) => sum + c.wastedBytes, 0);
  }, [duplicateClusters]);

  return (
    <div className="flex flex-col h-full bg-zinc-50/60 dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors font-sans">
      {/* Title */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Activity className="text-cyan-600 dark:text-cyan-400" size={22} />
          Anomalias de Rede: N+1 Queries & Race Conditions
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Identificação algorítmica de rajadas de requisições idênticas em janela curta (500ms) e inversão de respostas assíncronas que corrompem o estado da UI.
        </p>
      </div>

      {/* Top Impact KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* N+1 Bursts */}
        <div
          onClick={() => setActiveTab('n_plus_one')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-2xs ${
            activeTab === 'n_plus_one'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-1 ring-amber-400'
              : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-800 dark:text-amber-400 font-semibold uppercase tracking-wider">
            <span>Rajadas N+1 (500ms)</span>
            <Layers size={16} />
          </div>
          <div className="text-3xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {duplicateClusters.length} <span className="text-sm font-normal text-zinc-500">grupos</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {totalDuplicateRequests} requisições redundantes ({formatBytes(totalWastedBytes)} desperdiçados)
          </div>
        </div>

        {/* Race Conditions */}
        <div
          onClick={() => setActiveTab('race_conditions')}
          className={`p-4 rounded-lg border cursor-pointer transition shadow-2xs ${
            activeTab === 'race_conditions'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 ring-1 ring-rose-400'
              : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-800 dark:text-rose-400 font-semibold uppercase tracking-wider">
            <span>Race Conditions Detectadas</span>
            <GitCompare size={16} />
          </div>
          <div className="text-3xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1">
            {raceHazards.length} <span className="text-sm font-normal text-zinc-500">conflitos</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Respostas desatualizadas que chegaram após uma resposta mais recente
          </div>
        </div>

        {/* Latency Penalty */}
        <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
            <span>Eficiência de Cache</span>
            <Zap size={16} className="text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-cyan-700 dark:text-cyan-400 mt-1">
            {entries.length > 0
              ? `${Math.max(0, Math.round(((entries.length - totalDuplicateRequests) / entries.length) * 100))}%`
              : '100%'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Proporção de tráfego sem duplicidade em janela rápida</div>
        </div>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('n_plus_one')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'n_plus_one'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Rajadas N+1 & Duplicações ({duplicateClusters.length})
          </button>
          <button
            onClick={() => setActiveTab('race_conditions')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'race_conditions'
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Race Conditions Assíncronas ({raceHazards.length})
          </button>
        </div>

        <input
          type="text"
          placeholder="Filtrar por URL ou endpoint..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
        />
      </div>

      {/* TAB 1: N+1 QUERIES / BURSTS */}
      {activeTab === 'n_plus_one' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-1">
            <span>
              Mostrando {filteredClusters.length} ocorrências de chamadas idênticas em janela &le; 500ms
            </span>
            <span className="text-zinc-400">Recomendação: Implementar Stale-While-Revalidate / Deduplicação</span>
          </div>

          {filteredClusters.length === 0 ? (
            <div className="p-12 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-zinc-500">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhuma anomalia N+1 detectada!
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Não foram encontradas requisições idênticas disparadas simultaneamente dentro de 500ms.
              </p>
            </div>
          ) : (
            filteredClusters.map((cluster) => (
              <div
                key={cluster.id}
                className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-zinc-900/60 space-y-3 shadow-2xs hover:border-amber-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      {cluster.count}x Disparos Idênticos
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      Janela: {cluster.timeWindowMs} ms
                    </span>
                    {cluster.wastedBytes > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                        {formatBytes(cluster.wastedBytes)} redundantes
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-zinc-500 font-mono">
                    Método: <strong>{cluster.method}</strong>
                  </span>
                </div>

                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800 break-all">
                  {cluster.url}
                </div>

                {/* Individual requests timeline in this burst */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    Requisições na Rajada:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {cluster.entries.map((entry, idx) => {
                      const offsetMs =
                        new Date(entry.startedDateTime).getTime() - cluster.firstStartTime;
                      return (
                        <div
                          key={entry.id}
                          onClick={() => onSelectEntry(entry.id)}
                          className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-cyan-500 cursor-pointer transition text-xs font-mono flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              Req #{entry.index + 1}
                            </span>
                            <span className="text-[10px] text-zinc-500 ml-1.5">
                              (+{offsetMs}ms)
                            </span>
                          </div>
                          <span className="text-cyan-700 dark:text-cyan-400 text-[11px]">
                            {Math.round(entry.time)}ms &rarr;
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300">
                  <strong>Causa Raiz Provável:</strong> Loop de renderização no React (re-render sem useMemo/useCallback), múltiplos componentes filhos consultando a mesma query sem cache global compartilhado (ex: SWR / TanStack Query) ou falta de debouncing.
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: RACE CONDITIONS */}
      {activeTab === 'race_conditions' && (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between px-1">
            <span>
              Mostrando {filteredHazards.length} conflitos onde a ordem de resposta mudou em relação à ordem de envio
            </span>
            <span className="text-zinc-400">Risco: UI exibindo estado antigo sobrescrevendo estado novo</span>
          </div>

          {filteredHazards.length === 0 ? (
            <div className="p-12 text-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 text-zinc-500">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhuma Race Condition identificada!
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Todas as requisições paralelas terminaram em ordem consistente com os momentos de envio.
              </p>
            </div>
          ) : (
            filteredHazards.map((hazard) => (
              <div
                key={hazard.id}
                className="p-4 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-zinc-900/60 space-y-3 shadow-2xs hover:border-rose-400 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      RACE HAZARD
                    </span>
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Inversão de Resposta ({hazard.inversionDeltaMs}ms de atraso relativo)
                    </span>
                  </div>
                  <span className="text-xs font-mono text-zinc-500">
                    Endpoint: {hazard.reqA.parsedUrl.pathname}
                  </span>
                </div>

                <div className="font-mono text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800 break-all">
                  {hazard.url}
                </div>

                {/* Visual comparative explanation of the race */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  {/* Req A: Started first, finished LAST */}
                  <div
                    onClick={() => onSelectEntry(hazard.reqA.id)}
                    className="p-3 rounded bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 cursor-pointer hover:border-rose-400 transition"
                  >
                    <div className="flex items-center justify-between font-bold text-rose-800 dark:text-rose-300">
                      <span>Requisição Anterior (# {hazard.reqA.index + 1})</span>
                      <span className="text-[10px] uppercase">Chegou Por Último ⚠️</span>
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                      Iniciou primeiro, mas durou {Math.round(hazard.reqA.time)}ms.
                    </div>
                    <div className="text-[10px] text-rose-700 dark:text-rose-400 mt-1 font-sans">
                      &rarr; Perigo: Pode sobrescrever a resposta da Req #{hazard.reqB.index + 1} com dados velhos!
                    </div>
                  </div>

                  {/* Req B: Started later, finished FIRST */}
                  <div
                    onClick={() => onSelectEntry(hazard.reqB.id)}
                    className="p-3 rounded bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 cursor-pointer hover:border-emerald-400 transition"
                  >
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                      <span>Requisição Mais Recente (# {hazard.reqB.index + 1})</span>
                      <span className="text-[10px] uppercase">Chegou Primeiro &check;</span>
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                      Iniciou +{hazard.startDelayMs}ms depois, respondeu rápido em {Math.round(hazard.reqB.time)}ms.
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 font-sans">
                      &rarr; Estado mais novo que arrisca ser descartado pelo cliente.
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-300">
                  <strong>Correção Recomendada:</strong> Utilize <code>AbortController</code> para cancelar requisições anteriores quando uma nova for despachada (ex: busca rápida / auto-complete), ou vincule timestamps/sequence IDs para ignorar respostas obsoletas.
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
