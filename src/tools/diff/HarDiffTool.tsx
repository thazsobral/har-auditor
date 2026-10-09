import React, { useState, useMemo, useRef, ChangeEvent } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { HarRoot, EnrichedHarEntry } from '../../types/har.ts';
import {
  GitCompare,
  UploadCloud,
  FileCode,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Split,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';

interface MatchedPair {
  key: string;
  method: string;
  path: string;
  url: string;
  entryA?: EnrichedHarEntry;
  entryB?: any;
  statusA?: number;
  statusB?: number;
  timeA?: number;
  timeB?: number;
  sizeA?: number;
  sizeB?: number;
  statusDiff: boolean;
  timeDiffMs: number;
  sizeDiffBytes: number;
  type: 'matched' | 'only_a' | 'only_b';
}

export const HarDiffTool: React.FC<ToolPluginContext> = ({ har: harA, entries: entriesA }) => {
  const [harB, setHarB] = useState<HarRoot | null>(null);
  const [fileNameB, setFileNameB] = useState<string | null>(null);
  const [isLoadingB, setIsLoadingB] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'diffs' | 'only_a' | 'only_b'>('all');
  const [selectedPairKey, setSelectedPairKey] = useState<string | null>(null);
  const [payloadTab, setPayloadTab] = useState<'both' | 'a' | 'b'>('both');

  const fileInputRefB = useRef<HTMLInputElement>(null);

  // Load secondary HAR file
  const handleLoadHarB = async (file: File) => {
    setIsLoadingB(true);
    setFileNameB(file.name);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !parsed.log) {
        throw new Error('Arquivo HAR inválido: objeto raiz deve conter a chave "log".');
      }
      setHarB(parsed);
    } catch (err: any) {
      alert(`Falha ao ler segundo arquivo HAR: ${err.message || 'Arquivo inválido'}`);
      setHarB(null);
      setFileNameB(null);
    } finally {
      setIsLoadingB(false);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleLoadHarB(e.target.files[0]);
    }
  };

  // Generate mock secondary HAR for immediate preview if user wants to test
  const handleLoadDemoBaseline = () => {
    if (!harA) return;
    setIsLoadingB(true);
    setFileNameB('baseline-producao-anterior.har');

    // Simulate baseline with some modifications (e.g. fewer errors, different timings)
    const cloned = JSON.parse(JSON.stringify(harA));
    if (cloned.log && Array.isArray(cloned.log.entries)) {
      // Modify a few entries to demonstrate diffs
      cloned.log.entries = cloned.log.entries.slice(0, Math.max(1, cloned.log.entries.length - 1)).map((e: any, idx: number) => {
        if (idx === 0) {
          e.time = Math.round(e.time * 0.7); // 30% faster in baseline
        }
        if (e.response && e.response.status === 502) {
          e.response.status = 200; // was 200 in baseline, now 502 error!
          e.response.statusText = 'OK';
        }
        return e;
      });
    }

    setHarB(cloned);
    setIsLoadingB(false);
  };

  const entriesB: any[] = useMemo(() => {
    return harB?.log?.entries || [];
  }, [harB]);

  // Compute matched pairs between HAR A and HAR B
  const pairs = useMemo(() => {
    const list: MatchedPair[] = [];
    const mapB = new Map<string, any>();

    // Index B entries by Method + Clean Path
    entriesB.forEach((eb, idx) => {
      const method = (eb.request?.method || 'GET').toUpperCase();
      let path = eb.request?.url || '';
      try {
        path = new URL(eb.request?.url).pathname;
      } catch {
        // ignore
      }
      const key = `${method} ${path}`;
      if (!mapB.has(key)) {
        mapB.set(key, { ...eb, _index: idx });
      }
    });

    const matchedKeysInB = new Set<string>();

    // Process A entries
    entriesA.forEach((ea) => {
      const method = (ea.request?.method || 'GET').toUpperCase();
      const path = ea.parsedUrl?.pathname || ea.request?.url;
      const key = `${method} ${path}`;

      const matchedB = mapB.get(key);

      if (matchedB) {
        matchedKeysInB.add(key);
        const statusA = ea.response?.status || 0;
        const statusB = matchedB.response?.status || 0;
        const timeA = Math.round(ea.time || 0);
        const timeB = Math.round(matchedB.time || 0);
        const sizeA = ea.response?.content?.size || ea.response?.bodySize || 0;
        const sizeB = matchedB.response?.content?.size || matchedB.response?.bodySize || 0;

        list.push({
          key,
          method,
          path,
          url: ea.request.url,
          entryA: ea,
          entryB: matchedB,
          statusA,
          statusB,
          timeA,
          timeB,
          sizeA,
          sizeB,
          statusDiff: statusA !== statusB,
          timeDiffMs: timeA - timeB,
          sizeDiffBytes: sizeA - sizeB,
          type: 'matched',
        });
      } else {
        // Present in A, missing in B
        list.push({
          key,
          method,
          path,
          url: ea.request.url,
          entryA: ea,
          statusA: ea.response?.status,
          timeA: Math.round(ea.time),
          sizeA: ea.response?.content?.size || ea.response?.bodySize || 0,
          statusDiff: true,
          timeDiffMs: Math.round(ea.time),
          sizeDiffBytes: 0,
          type: 'only_a',
        });
      }
    });

    // Entries in B that were not in A (New in B)
    mapB.forEach((eb, key) => {
      if (!matchedKeysInB.has(key)) {
        const method = (eb.request?.method || 'GET').toUpperCase();
        let path = eb.request?.url || '';
        try {
          path = new URL(eb.request?.url).pathname;
        } catch {
          // ignore
        }
        list.push({
          key,
          method,
          path,
          url: eb.request?.url,
          entryB: eb,
          statusB: eb.response?.status,
          timeB: Math.round(eb.time || 0),
          sizeB: eb.response?.content?.size || eb.response?.bodySize || 0,
          statusDiff: true,
          timeDiffMs: 0,
          sizeDiffBytes: 0,
          type: 'only_b',
        });
      }
    });

    return list;
  }, [entriesA, entriesB]);

  // Aggregate comparative statistics
  const comparisonStats = useMemo(() => {
    const totalReqsA = entriesA.length;
    const totalReqsB = entriesB.length;

    const totalSizeA = entriesA.reduce(
      (sum, e) => sum + (e.response.content?.size || e.response.bodySize || 0),
      0
    );
    const totalSizeB = entriesB.reduce(
      (sum, e) => sum + (e.response?.content?.size || e.response?.bodySize || 0),
      0
    );

    const totalTimeA = entriesA.reduce((sum, e) => sum + (e.time || 0), 0);
    const totalTimeB = entriesB.reduce((sum, e) => sum + (e.time || 0), 0);

    const errorsA = entriesA.filter((e) => e.isError).length;
    const errorsB = entriesB.filter((e) => {
      const s = e.response?.status || 0;
      return s >= 400 || s === 0;
    }).length;

    return {
      totalReqsA,
      totalReqsB,
      reqsDiff: totalReqsA - totalReqsB,
      totalSizeA,
      totalSizeB,
      sizeDiff: totalSizeA - totalSizeB,
      totalTimeA: Math.round(totalTimeA),
      totalTimeB: Math.round(totalTimeB),
      timeDiff: Math.round(totalTimeA - totalTimeB),
      errorsA,
      errorsB,
      errorsDiff: errorsA - errorsB,
    };
  }, [entriesA, entriesB]);

  const filteredPairs = useMemo(() => {
    return pairs.filter((p) => {
      if (filterType === 'diffs') {
        return p.statusDiff || Math.abs(p.timeDiffMs) > 100 || p.type !== 'matched';
      }
      if (filterType === 'only_a') return p.type === 'only_a';
      if (filterType === 'only_b') return p.type === 'only_b';
      return true;
    });
  }, [pairs, filterType]);

  const activeSelectedPair = useMemo(() => {
    if (!selectedPairKey) return pairs[0] || null;
    return pairs.find((p) => p.key === selectedPairKey) || pairs[0] || null;
  }, [pairs, selectedPairKey]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/60 dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors font-sans">
      <input
        ref={fileInputRefB}
        type="file"
        accept=".har,application/json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <GitCompare className="text-cyan-600 dark:text-cyan-400" size={22} />
            HAR Diff: Comparador de Execuções e Regressões
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Compare o arquivo HAR atual (Baseline A) com um segundo arquivo (HAR B) para identificar chamadas faltantes, mudanças de status HTTP e variações de payload.
          </p>
        </div>

        {/* Load HAR B Actions */}
        <div className="flex items-center gap-2">
          {!harB && (
            <button
              onClick={handleLoadDemoBaseline}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles size={14} className="text-cyan-600 dark:text-cyan-400" />
              <span>Simular Baseline Anterior</span>
            </button>
          )}

          <button
            onClick={() => fileInputRefB.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition"
          >
            <UploadCloud size={15} />
            <span>{harB ? 'Substituir HAR B' : 'Carregar Segundo HAR (B)'}</span>
          </button>
        </div>
      </div>

      {!harB ? (
        /* Empty State: Prompting to load HAR B */
        <div className="p-10 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-950 flex items-center justify-center mx-auto text-cyan-600 dark:text-cyan-400">
            <Split size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Pronto para comparar: HAR A carregado com {entriesA.length} requisições
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
              Selecione um segundo arquivo .HAR (ex: versão anterior de produção ou ambiente de staging) para gerar a análise diferencial completa.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => fileInputRefB.current?.click()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
            >
              Selecionar Arquivo HAR B
            </button>
            <button
              onClick={handleLoadDemoBaseline}
              className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold transition border border-zinc-200 dark:border-zinc-700"
            >
              Usar Amostra de Comparação
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Comparative Metrics Banner (A vs B) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Reqs Delta */}
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Total de Requisições
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {comparisonStats.totalReqsA} vs {comparisonStats.totalReqsB}
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    comparisonStats.reqsDiff === 0
                      ? 'text-zinc-400'
                      : comparisonStats.reqsDiff > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {comparisonStats.reqsDiff > 0 ? `+${comparisonStats.reqsDiff}` : comparisonStats.reqsDiff}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">HAR A (Atual) vs HAR B ({fileNameB})</div>
            </div>

            {/* Total Size Delta */}
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Volume Transferido
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-cyan-700 dark:text-cyan-400">
                  {formatBytes(comparisonStats.totalSizeA)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">vs {formatBytes(comparisonStats.totalSizeB)}</span>
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                Variação: {comparisonStats.sizeDiff >= 0 ? `+${formatBytes(comparisonStats.sizeDiff)}` : `-${formatBytes(Math.abs(comparisonStats.sizeDiff))}`}
              </div>
            </div>

            {/* Total Latency Delta */}
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Tempo Total Acumulado
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {comparisonStats.totalTimeA}ms
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">vs {comparisonStats.totalTimeB}ms</span>
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                Delta: {comparisonStats.timeDiff >= 0 ? `+${comparisonStats.timeDiff}ms` : `${comparisonStats.timeDiff}ms`}
              </div>
            </div>

            {/* Errors Delta */}
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
              <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Erros HTTP (4xx / 5xx)
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-400">
                  {comparisonStats.errorsA} vs {comparisonStats.errorsB}
                </span>
                <span
                  className={`text-xs font-mono font-bold ${
                    comparisonStats.errorsDiff > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {comparisonStats.errorsDiff > 0 ? `+${comparisonStats.errorsDiff} novos erros` : 'Sem novos erros'}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">Falhas de status entre versões</div>
            </div>
          </div>

          {/* Diff Controls & Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filterType === 'all'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Todas as Rotas ({pairs.length})
              </button>
              <button
                onClick={() => setFilterType('diffs')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filterType === 'diffs'
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Apenas com Diferenças ({pairs.filter((p) => p.statusDiff || p.type !== 'matched').length})
              </button>
              <button
                onClick={() => setFilterType('only_a')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filterType === 'only_a'
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Presentes Apenas em A ({pairs.filter((p) => p.type === 'only_a').length})
              </button>
              <button
                onClick={() => setFilterType('only_b')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  filterType === 'only_b'
                    ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                Presentes Apenas em B ({pairs.filter((p) => p.type === 'only_b').length})
              </button>
            </div>

            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
              Clique em uma linha para comparar detalhes de cabeçalhos e payloads
            </span>
          </div>

          {/* Diff Grid: Endpoints Table + Side-by-Side Detailed Inspection */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Table of Compared Endpoints */}
            <div className="lg:col-span-7 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/60 shadow-2xs flex flex-col">
              {/* Block Header Title */}
              <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Split size={14} className="text-cyan-600 dark:text-cyan-400" />
                  Rotas e Endpoints Comparados
                </span>
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  Exibindo {filteredPairs.length} de {pairs.length} rotas
                </span>
              </div>

              {/* Table Column Subheaders */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                <div className="col-span-6">Endpoint / Rota</div>
                <div className="col-span-3 text-center">Status (A vs B)</div>
                <div className="col-span-3 text-right">Latência (&Delta;)</div>
              </div>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800/60 max-h-96 overflow-y-auto text-xs font-mono">
                {filteredPairs.map((pair) => {
                  const isSelected = activeSelectedPair?.key === pair.key;

                  return (
                    <div
                      key={pair.key}
                      onClick={() => setSelectedPairKey(pair.key)}
                      className={`grid grid-cols-12 gap-2 px-3 py-2 items-center cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-cyan-50 dark:bg-cyan-950/40 border-l-3 border-l-cyan-600 dark:border-l-cyan-400'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      {/* Method + Path */}
                      <div className="col-span-6 truncate">
                        <span className="font-bold text-cyan-700 dark:text-cyan-400 mr-1.5">
                          {pair.method}
                        </span>
                        <span className="text-zinc-800 dark:text-zinc-200">{pair.path}</span>
                      </div>

                      {/* Status Compare */}
                      <div className="col-span-3 text-center">
                        {pair.type === 'matched' ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pair.statusDiff
                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {pair.statusA} &rarr; {pair.statusB}
                          </span>
                        ) : pair.type === 'only_a' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                            Apenas em A
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300">
                            Novo em B
                          </span>
                        )}
                      </div>

                      {/* Time Delta */}
                      <div className="col-span-3 text-right">
                        {pair.type === 'matched' ? (
                          <span
                            className={`text-[11px] ${
                              pair.timeDiffMs > 100
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : pair.timeDiffMs < -100
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {pair.timeA}ms / {pair.timeB}ms (
                            {pair.timeDiffMs > 0 ? `+${pair.timeDiffMs}` : pair.timeDiffMs}ms)
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side-by-Side Detailed Inspection for selected pair */}
            <div className="lg:col-span-5 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/60 shadow-2xs flex flex-col">
              {/* Block Header Title */}
              <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 font-sans font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <GitCompare size={14} className="text-cyan-600 dark:text-cyan-400" />
                  Inspeção Lado a Lado do Endpoint
                </span>
                <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 truncate max-w-[200px]" title={`${activeSelectedPair?.method} ${activeSelectedPair?.path}`}>
                  {activeSelectedPair?.method} {activeSelectedPair?.path}
                </span>
              </div>

              {activeSelectedPair ? (
                <div className="p-3 space-y-4 overflow-y-auto max-h-96 text-xs font-mono">
                  {/* Status & Timing Compare */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-700 dark:text-zinc-300 uppercase font-bold tracking-wider">
                        HAR A (Atual)
                      </div>
                      <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                        Status {activeSelectedPair.statusA || 'N/A'}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{activeSelectedPair.timeA ?? 0}ms</div>
                    </div>

                    <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-700 dark:text-zinc-300 uppercase font-bold tracking-wider">
                        HAR B ({fileNameB || 'Arquivo B'})
                      </div>
                      <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                        Status {activeSelectedPair.statusB || 'N/A'}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{activeSelectedPair.timeB ?? 0}ms</div>
                    </div>
                  </div>

                  {/* Headers in A vs Headers in B */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-sans font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <FileCode size={13} className="text-cyan-600 dark:text-cyan-400" />
                      <span>Comparação de Response Headers</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {/* Headers A */}
                      <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto text-[11px]">
                        <div className="text-zinc-900 dark:text-zinc-100 font-semibold mb-1 pb-1 border-b border-zinc-200 dark:border-zinc-800 flex justify-between">
                          <span>Headers A</span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                            ({activeSelectedPair.entryA?.response?.headers?.length || 0})
                          </span>
                        </div>
                        {activeSelectedPair.entryA?.response?.headers && activeSelectedPair.entryA.response.headers.length > 0 ? (
                          activeSelectedPair.entryA.response.headers.slice(0, 8).map((h: any, i: number) => (
                            <div key={i} className="text-zinc-600 dark:text-zinc-400 truncate py-0.5" title={`${h.name}: ${h.value}`}>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{h.name}:</span> {h.value}
                            </div>
                          ))
                        ) : (
                          <div className="text-zinc-400 italic">Sem headers ou rota ausente</div>
                        )}
                      </div>

                      {/* Headers B */}
                      <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto text-[11px]">
                        <div className="text-zinc-900 dark:text-zinc-100 font-semibold mb-1 pb-1 border-b border-zinc-200 dark:border-zinc-800 flex justify-between">
                          <span>Headers B</span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                            ({activeSelectedPair.entryB?.response?.headers?.length || 0})
                          </span>
                        </div>
                        {activeSelectedPair.entryB?.response?.headers && activeSelectedPair.entryB.response.headers.length > 0 ? (
                          activeSelectedPair.entryB.response.headers.slice(0, 8).map((h: any, i: number) => (
                            <div key={i} className="text-zinc-600 dark:text-zinc-400 truncate py-0.5" title={`${h.name}: ${h.value}`}>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{h.name}:</span> {h.value}
                            </div>
                          ))
                        ) : (
                          <div className="text-zinc-400 italic">Sem headers ou rota ausente</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Response Body comparison (Payload A vs Payload B) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-sans font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <FileCode size={13} className="text-cyan-600 dark:text-cyan-400" />
                        <span>Comparação de Response Payload</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-sans">
                        <button
                          onClick={() => setPayloadTab('both')}
                          className={`px-2 py-0.5 rounded transition ${
                            payloadTab === 'both'
                              ? 'bg-zinc-200 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                          }`}
                        >
                          Lado a Lado
                        </button>
                        <button
                          onClick={() => setPayloadTab('a')}
                          className={`px-2 py-0.5 rounded transition ${
                            payloadTab === 'a'
                              ? 'bg-zinc-200 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                          }`}
                        >
                          Apenas A
                        </button>
                        <button
                          onClick={() => setPayloadTab('b')}
                          className={`px-2 py-0.5 rounded transition ${
                            payloadTab === 'b'
                              ? 'bg-zinc-200 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                          }`}
                        >
                          Apenas B
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(payloadTab === 'both' || payloadTab === 'a') && (
                        <div className={payloadTab === 'a' ? 'col-span-2' : ''}>
                          <div className="text-[10px] font-sans font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                            Corpo da Resposta A:
                          </div>
                          <pre className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-36 overflow-x-auto text-[10px] text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-all leading-relaxed">
                            {activeSelectedPair.entryA?.response?.content?.text || '[Sem corpo ou binário em A]'}
                          </pre>
                        </div>
                      )}

                      {(payloadTab === 'both' || payloadTab === 'b') && (
                        <div className={payloadTab === 'b' ? 'col-span-2' : ''}>
                          <div className="text-[10px] font-sans font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                            Corpo da Resposta B:
                          </div>
                          <pre className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-36 overflow-x-auto text-[10px] text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-all leading-relaxed">
                            {activeSelectedPair.entryB?.response?.content?.text || '[Sem corpo ou binário em B]'}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                  Selecione um endpoint na tabela para visualizar o diff detalhado.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
