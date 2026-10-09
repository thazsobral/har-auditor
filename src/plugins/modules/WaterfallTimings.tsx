import React, { useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import { Clock } from 'lucide-react';

export const WaterfallTimings: React.FC<ToolPluginContext> = ({ entries, onSelectEntry }) => {
  const { timeline, maxTotalDuration, maxTime } = useMemo(() => {
    if (entries.length === 0) return { timeline: [], maxTotalDuration: 0, maxTime: 1 };

    const firstStartTime = new Date(entries[0].startedDateTime).getTime();
    let maxEnd = 0;
    let longestRequest = 0;

    const list = entries.map((e) => {
      const startMs = Math.max(0, new Date(e.startedDateTime).getTime() - firstStartTime);
      const duration = Math.max(1, e.time);
      const endMs = startMs + duration;
      if (endMs > maxEnd) maxEnd = endMs;
      if (duration > longestRequest) longestRequest = duration;

      return {
        entry: e,
        startMs,
        duration,
        endMs,
        timings: e.timings,
      };
    });

    return {
      timeline: list,
      maxTotalDuration: maxEnd || 1000,
      maxTime: longestRequest || 100,
    };
  }, [entries]);

  const slowestEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.time - a.time).slice(0, 5);
  }, [entries]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Clock className="text-cyan-600 dark:text-cyan-400" size={20} />
          Linha do Tempo de Execução & Análise de Latência (Waterfall)
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Diagnóstico de bloqueio de conexão, negociação TLS, TTFB (Time To First Byte) e tempo de download por recurso.
        </p>
      </div>

      {/* Top Latency Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Janela Total Gravada</div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {(maxTotalDuration / 1000).toFixed(2)} s
          </div>
          <div className="text-xs text-zinc-500 mt-1">Do primeiro ao último pacote recebido</div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Requisição Mais Lenta</div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
            {Math.round(maxTime)} ms
          </div>
          <div className="text-xs text-zinc-500 mt-1">Gargalo potencial no backend ou rede</div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Média por Requisição</div>
          <div className="text-2xl font-bold font-mono text-cyan-700 dark:text-cyan-400 mt-1">
            {entries.length > 0 ? Math.round(entries.reduce((acc, curr) => acc + curr.time, 0) / entries.length) : 0} ms
          </div>
          <div className="text-xs text-zinc-500 mt-1">Média ponderada do conjunto</div>
        </div>
      </div>

      {/* Waterfall Visualization */}
      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Cascata de Conexões ({timeline.length} requisições)
          </span>
          <div className="flex items-center gap-3 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" /> DNS / Connect</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 inline-block" /> TTFB (Espera)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Download</span>
          </div>
        </div>

        <div className="space-y-1.5 font-mono text-xs">
          {timeline.map(({ entry, startMs, duration }) => {
            const startPct = Math.min(95, (startMs / maxTotalDuration) * 100);
            const widthPct = Math.max(2, Math.min(100 - startPct, (duration / maxTotalDuration) * 100));

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry.id)}
                className="grid grid-cols-12 gap-2 items-center hover:bg-zinc-100 dark:hover:bg-zinc-900 p-1.5 rounded cursor-pointer transition group"
              >
                <div className="col-span-4 truncate text-zinc-700 dark:text-zinc-300 text-xs flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 w-6">#{entry.index + 1}</span>
                  <span className="truncate">{entry.parsedUrl.pathname}</span>
                </div>

                <div className="col-span-6 relative h-5 bg-zinc-200/80 dark:bg-zinc-900/90 rounded overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 bg-cyan-600/90 dark:bg-cyan-600/80 rounded group-hover:bg-cyan-500 transition-all flex items-center justify-end px-1"
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                    }}
                  />
                </div>

                <div className="col-span-2 text-right text-zinc-600 dark:text-zinc-400 text-xs font-mono">
                  {Math.round(entry.time)} ms
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 5 Slowest Endpoints Table */}
      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-xs">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
          Top 5 Requisições Mais Lentas (Otimização Prioritária)
        </span>
        <div className="space-y-2">
          {slowestEntries.map((e) => (
            <div
              key={e.id}
              onClick={() => onSelectEntry(e.id)}
              className="p-3 bg-white dark:bg-zinc-900/80 rounded border border-zinc-200 dark:border-zinc-800/80 hover:border-cyan-500 cursor-pointer transition flex items-center justify-between text-xs font-mono shadow-xs"
            >
              <div className="min-w-0 flex-1 truncate pr-3">
                <span className="text-cyan-700 dark:text-cyan-400 font-bold mr-2">{e.request.method}</span>
                <span className="text-zinc-800 dark:text-zinc-200">{e.request.url}</span>
              </div>
              <div className="text-amber-700 dark:text-amber-400 font-bold whitespace-nowrap">
                {Math.round(e.time)} ms
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
