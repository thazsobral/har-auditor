import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { HarRoot, HarHeader, EnrichedHarEntry } from '../../types/har.ts';
import {
  ShieldCheck,
  Download,
  CheckCircle2,
  Plus,
  X,
  FileCheck,
  Lock,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  FileCode,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

export const SanitizerTool: React.FC<ToolPluginContext> = ({ har, entries }) => {
  // Preset headers to strip
  const [headersToRemove, setHeadersToRemove] = useState<string[]>([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'api-key',
    'proxy-authorization',
    'x-auth-token',
  ]);

  // Specific body keys to redact
  const [bodyKeysToRedact, setBodyKeysToRedact] = useState<string[]>([
    'password',
    'token',
    'access_token',
    'secret',
    'cpf',
    'email',
    'credit_card',
    'card_number',
    'cvv',
    'refresh_token',
  ]);

  // Query param keys to redact
  const [queryKeysToRedact, setQueryKeysToRedact] = useState<string[]>([
    'token',
    'access_token',
    'api_key',
    'apikey',
    'key',
    'secret',
    'auth',
    'password',
  ]);

  // Global options
  const [clearAllCookies, setClearAllCookies] = useState(true);
  const [redactQueryParams, setRedactQueryParams] = useState(true);
  const [redactBodies, setRedactBodies] = useState(true);
  const [anonymizeIps, setAnonymizeIps] = useState(true);
  const [customHeaderInput, setCustomHeaderInput] = useState('');
  const [customBodyKeyInput, setCustomBodyKeyInput] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // View state: 'result' (Comparativo Antes/Depois) vs 'rules' (Configuração de Regras)
  const [viewMode, setViewMode] = useState<'result' | 'rules'>('result');

  // Selected entry for comparison preview
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number>(0);
  const [comparisonTab, setComparisonTab] = useState<'headers' | 'body' | 'url'>('headers');

  // Add custom header
  const handleAddHeader = () => {
    const val = customHeaderInput.trim().toLowerCase();
    if (val && !headersToRemove.includes(val)) {
      setHeadersToRemove([...headersToRemove, val]);
      setCustomHeaderInput('');
    }
  };

  // Add custom body key
  const handleAddBodyKey = () => {
    const val = customBodyKeyInput.trim().toLowerCase();
    if (val && !bodyKeysToRedact.includes(val)) {
      setBodyKeysToRedact([...bodyKeysToRedact, val]);
      setCustomBodyKeyInput('');
    }
  };

  // Calculate impact statistics
  const stats = useMemo(() => {
    if (!entries) return { headersAffected: 0, cookiesAffected: 0, queryParamsAffected: 0, bodiesAffected: 0 };

    let headersAffected = 0;
    let cookiesAffected = 0;
    let queryParamsAffected = 0;
    let bodiesAffected = 0;

    entries.forEach((e) => {
      const reqH = e.request.headers || [];
      const resH = e.response.headers || [];
      const totalH = [...reqH, ...resH];
      headersAffected += totalH.filter((h) => headersToRemove.includes(h.name.toLowerCase())).length;

      if (clearAllCookies) {
        cookiesAffected += (e.request.cookies?.length || 0) + (e.response.cookies?.length || 0);
      }

      if (redactQueryParams && e.request.queryString) {
        queryParamsAffected += e.request.queryString.filter((q) =>
          queryKeysToRedact.some((k) => q.name.toLowerCase().includes(k))
        ).length;
      }

      if (redactBodies) {
        const text = e.request.postData?.text || e.response.content?.text || '';
        if (text && bodyKeysToRedact.some((k) => text.toLowerCase().includes(`"${k}"`))) {
          bodiesAffected++;
        }
      }
    });

    return { headersAffected, cookiesAffected, queryParamsAffected, bodiesAffected };
  }, [entries, headersToRemove, bodyKeysToRedact, queryKeysToRedact, clearAllCookies, redactQueryParams, redactBodies]);

  // Recursively sanitize JSON objects
  const sanitizeJsonValue = (obj: any, keysToMask: string[]): any => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeJsonValue(item, keysToMask));
    }

    const copy: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (keysToMask.some((k) => lower.includes(k))) {
        copy[key] = '[REDACTED_LGPD]';
      } else if (typeof value === 'object' && value !== null) {
        copy[key] = sanitizeJsonValue(value, keysToMask);
      } else {
        copy[key] = value;
      }
    }
    return copy;
  };

  // Build and download sanitized HAR
  const handleDownloadSanitized = () => {
    if (!har) return;
    setIsExporting(true);

    try {
      const clonedLog = JSON.parse(JSON.stringify(har.log));

      clonedLog.entries = clonedLog.entries.map((entry: any) => {
        if (anonymizeIps && entry.serverIPAddress) {
          entry.serverIPAddress = '127.0.0.1';
        }

        if (entry.request?.headers) {
          entry.request.headers = entry.request.headers.filter(
            (h: HarHeader) => !headersToRemove.includes(h.name.toLowerCase())
          );
        }

        if (entry.response?.headers) {
          entry.response.headers = entry.response.headers.filter(
            (h: HarHeader) => !headersToRemove.includes(h.name.toLowerCase())
          );
        }

        if (clearAllCookies) {
          if (entry.request) entry.request.cookies = [];
          if (entry.response) entry.response.cookies = [];
        }

        if (redactQueryParams && entry.request) {
          if (Array.isArray(entry.request.queryString)) {
            entry.request.queryString = entry.request.queryString.map((q: any) => {
              if (queryKeysToRedact.some((k) => q.name.toLowerCase().includes(k))) {
                return { ...q, value: '[REDACTED_TOKEN]' };
              }
              return q;
            });
          }

          try {
            const u = new URL(entry.request.url);
            for (const paramKey of Array.from(u.searchParams.keys())) {
              if (queryKeysToRedact.some((k) => paramKey.toLowerCase().includes(k))) {
                u.searchParams.set(paramKey, '[REDACTED_TOKEN]');
              }
            }
            entry.request.url = u.toString();
          } catch {
            // ignore
          }
        }

        if (redactBodies) {
          if (entry.request?.postData?.text) {
            try {
              const parsed = JSON.parse(entry.request.postData.text);
              const sanitized = sanitizeJsonValue(parsed, bodyKeysToRedact);
              entry.request.postData.text = JSON.stringify(sanitized, null, 2);
            } catch {
              let txt = entry.request.postData.text;
              bodyKeysToRedact.forEach((k) => {
                const regex = new RegExp(`("${k}"\\s*:\\s*")[^"]+(")`, 'gi');
                txt = txt.replace(regex, '$1[REDACTED_LGPD]$2');
              });
              entry.request.postData.text = txt;
            }
          }

          if (entry.response?.content?.text) {
            try {
              const parsed = JSON.parse(entry.response.content.text);
              const sanitized = sanitizeJsonValue(parsed, bodyKeysToRedact);
              entry.response.content.text = JSON.stringify(sanitized, null, 2);
            } catch {
              // ignore
            }
          }
        }

        return entry;
      });

      const sanitizedHar: HarRoot = { log: clonedLog };
      const outputJson = JSON.stringify(sanitizedHar, null, 2);
      const blob = new Blob([outputJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sanitized-lgpd-${Date.now()}.har`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error('Falha ao sanitizar arquivo HAR:', err);
      alert('Erro ao processar o arquivo sanitizado.');
    } finally {
      setIsExporting(false);
    }
  };

  // Target entry for comparison preview
  const currentEntry: EnrichedHarEntry | null = entries[selectedEntryIndex] || entries[0] || null;

  // Comparison Data: Headers
  const comparisonHeaders = useMemo(() => {
    if (!currentEntry) return { originalReq: [], sanitizedReq: [], originalRes: [], sanitizedRes: [] };

    const reqHeaders = currentEntry.request.headers || [];
    const resHeaders = currentEntry.response.headers || [];

    const isHeaderRemoved = (name: string) => headersToRemove.includes(name.toLowerCase());

    return {
      originalReq: reqHeaders.map((h) => ({
        ...h,
        removed: isHeaderRemoved(h.name),
      })),
      sanitizedReq: reqHeaders.filter((h) => !isHeaderRemoved(h.name)),
      originalRes: resHeaders.map((h) => ({
        ...h,
        removed: isHeaderRemoved(h.name),
      })),
      sanitizedRes: resHeaders.filter((h) => !isHeaderRemoved(h.name)),
    };
  }, [currentEntry, headersToRemove]);

  // Comparison Data: Body
  const comparisonBody = useMemo(() => {
    if (!currentEntry) return { original: '', sanitized: '', isJson: false };

    const rawText = currentEntry.request.postData?.text || currentEntry.response.content?.text || '';
    if (!rawText) return { original: '', sanitized: '', isJson: false };

    try {
      const parsed = JSON.parse(rawText);
      const sanitized = sanitizeJsonValue(parsed, bodyKeysToRedact);
      return {
        original: JSON.stringify(parsed, null, 2),
        sanitized: JSON.stringify(sanitized, null, 2),
        isJson: true,
      };
    } catch {
      let sanitizedText = rawText;
      bodyKeysToRedact.forEach((k) => {
        const regex = new RegExp(`("${k}"\\s*:\\s*")[^"]+(")`, 'gi');
        sanitizedText = sanitizedText.replace(regex, '$1[REDACTED_LGPD]$2');
      });
      return {
        original: rawText,
        sanitized: sanitizedText,
        isJson: false,
      };
    }
  }, [currentEntry, bodyKeysToRedact]);

  // Comparison Data: URL & Query String
  const comparisonUrl = useMemo(() => {
    if (!currentEntry) return { original: '', sanitized: '' };

    const originalUrl = currentEntry.request.url || '';
    let sanitizedUrl = originalUrl;

    try {
      const u = new URL(originalUrl);
      for (const paramKey of Array.from(u.searchParams.keys())) {
        if (queryKeysToRedact.some((k) => paramKey.toLowerCase().includes(k))) {
          u.searchParams.set(paramKey, '[REDACTED_TOKEN]');
        }
      }
      sanitizedUrl = u.toString();
    } catch {
      // ignore
    }

    return { original: originalUrl, sanitized: sanitizedUrl };
  }, [currentEntry, queryKeysToRedact]);

  return (
    <div className="flex flex-col h-full bg-zinc-50/60 dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors font-sans">
      {/* Top Banner & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="text-emerald-600 dark:text-emerald-400" size={22} />
            Sanitizador de Arquivos & Privacidade (LGPD / GDPR)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Compare antes e depois da higienização para ter 100% de confiança antes de exportar e compartilhar dados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Requested Switch Button: Mostrar Resultado vs Mostrar Regras */}
          <button
            onClick={() => setViewMode(viewMode === 'result' ? 'rules' : 'result')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shadow-2xs"
            title={viewMode === 'result' ? 'Clique para editar as regras e chaves' : 'Clique para ver o resultado do comparativo'}
          >
            {viewMode === 'result' ? (
              <>
                <SlidersHorizontal size={14} className="text-cyan-600 dark:text-cyan-400" />
                <span>Mostrar Regras</span>
              </>
            ) : (
              <>
                <Eye size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>Mostrar Resultado</span>
              </>
            )}
          </button>

          {/* Download Sanitized HAR Button */}
          <button
            onClick={handleDownloadSanitized}
            disabled={!har || isExporting}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition ${
              !har || isExporting
                ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/20'
            }`}
          >
            {isExporting ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Gerando HAR...</span>
              </>
            ) : exportSuccess ? (
              <>
                <FileCheck size={15} className="text-white" />
                <span>HAR Baixado com Sucesso!</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Baixar HAR Sanitizado (.har)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Impact Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">
            Headers Removidos
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
            {stats.headersAffected}
          </div>
          <div className="text-[10px] text-zinc-500">Authorization, API Keys, etc.</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">
            Cookies Limpos
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-700 dark:text-cyan-400 mt-0.5">
            {stats.cookiesAffected}
          </div>
          <div className="text-[10px] text-zinc-500">Sessões e identificadores únicos</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">
            Tokens em URL Mascarados
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-0.5">
            {stats.queryParamsAffected}
          </div>
          <div className="text-[10px] text-zinc-500">Parâmetros de query sensíveis</div>
        </div>

        <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">
            Payloads Protegidos
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
            {stats.bodiesAffected}
          </div>
          <div className="text-[10px] text-zinc-500">JSON com senhas, CPFs ou PIIs</div>
        </div>
      </div>

      {/* VIEW 1: COMPARATIVE RESULT PREVIEW ("MOSTRAR RESULTADO") */}
      {viewMode === 'result' && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 overflow-hidden shadow-xs space-y-0 animate-in fade-in duration-150">
          {entries.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <FileCode size={36} className="mx-auto text-zinc-400 mb-2" />
              <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                Nenhum arquivo .HAR carregado para comparação
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Importe um arquivo .HAR ou carregue a amostra de teste para visualizar o comparativo antes e depois.
              </p>
            </div>
          ) : (
            <>
              {/* Comparison Header Bar */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-cyan-600 dark:text-cyan-400" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Comparativo Interativo: <span className="text-rose-600 dark:text-rose-400">Como Está (Original)</span> vs{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">Como Irá Ficar (Sanitizado)</span>
                  </h3>
                </div>

                {/* Request Picker Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Requisição em Análise:</span>
                  <select
                    value={selectedEntryIndex}
                    onChange={(e) => setSelectedEntryIndex(Number(e.target.value))}
                    className="text-xs font-mono bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    {entries.map((entry, idx) => {
                      const hasSensitiveHeader = entry.request.headers.some((h) =>
                        headersToRemove.includes(h.name.toLowerCase())
                      );
                      return (
                        <option key={entry.id} value={idx}>
                          #{idx + 1} [{entry.request.method}] {entry.parsedUrl.pathname}{' '}
                          {hasSensitiveHeader ? '⚠️ (Possui Auth/Cookie)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* View Mode Tabs (Headers vs Body vs URL) */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-4 text-xs font-medium">
                <button
                  onClick={() => setComparisonTab('headers')}
                  className={`px-4 py-2.5 border-b-2 transition ${
                    comparisonTab === 'headers'
                      ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400 font-semibold'
                      : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Cabeçalhos HTTP (Headers)
                </button>
                <button
                  onClick={() => setComparisonTab('body')}
                  className={`px-4 py-2.5 border-b-2 transition ${
                    comparisonTab === 'body'
                      ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400 font-semibold'
                      : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Corpo / Payload (Body JSON)
                </button>
                <button
                  onClick={() => setComparisonTab('url')}
                  className={`px-4 py-2.5 border-b-2 transition ${
                    comparisonTab === 'url'
                      ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400 font-semibold'
                      : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  URL & Query String
                </button>
              </div>

              {/* Side-by-Side Comparison Canvas */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT: ORIGINAL (COMO ESTÁ) */}
                <div className="border border-rose-200 dark:border-rose-950 rounded-lg overflow-hidden bg-rose-50/30 dark:bg-rose-950/10 flex flex-col">
                  <div className="px-3.5 py-2.5 bg-rose-100/70 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs font-semibold text-rose-900 dark:text-rose-200">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-rose-600 dark:text-rose-400" />
                      Como Está Agora (Original Não Sanitizado)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200">
                      Dados Expostos
                    </span>
                  </div>

                  <div className="p-3 flex-1 overflow-y-auto max-h-80 font-mono text-xs">
                    {comparisonTab === 'headers' && (
                      <div className="space-y-1.5 divide-y divide-rose-200/50 dark:divide-rose-900/30">
                        {comparisonHeaders.originalReq.length === 0 ? (
                          <div className="p-4 text-center text-zinc-500">Sem cabeçalhos na requisição.</div>
                        ) : (
                          comparisonHeaders.originalReq.map((h, i) => (
                            <div
                              key={i}
                              className={`pt-1.5 first:pt-0 flex items-start justify-between gap-2 p-1 rounded ${
                                h.removed
                                  ? 'bg-rose-100/80 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800'
                                  : ''
                              }`}
                            >
                              <div className="min-w-0 flex-1 truncate">
                                <span className={`font-bold ${h.removed ? 'text-rose-700 dark:text-rose-300' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                  {h.name}:
                                </span>{' '}
                                <span className="text-zinc-800 dark:text-zinc-300 break-all">{h.value}</span>
                              </div>
                              {h.removed && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-600 text-white shrink-0">
                                  Expurgado
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {comparisonTab === 'body' && (
                      <div>
                        {comparisonBody.original ? (
                          <pre className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-all leading-relaxed bg-white/70 dark:bg-black/40 p-2.5 rounded border border-rose-200 dark:border-rose-950">
                            {comparisonBody.original}
                          </pre>
                        ) : (
                          <div className="p-6 text-center text-zinc-500">Nenhum payload nesta requisição.</div>
                        )}
                      </div>
                    )}

                    {comparisonTab === 'url' && (
                      <div className="p-3 bg-white/70 dark:bg-black/40 rounded border border-rose-200 dark:border-rose-950 break-all leading-relaxed text-zinc-800 dark:text-zinc-200">
                        {comparisonUrl.original}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: SANITIZED (COMO IRÁ FICAR) */}
                <div className="border border-emerald-200 dark:border-emerald-950 rounded-lg overflow-hidden bg-emerald-50/30 dark:bg-emerald-950/10 flex flex-col">
                  <div className="px-3.5 py-2.5 bg-emerald-100/70 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                      Como Irá Ficar (Sanitizado para Exportação)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                      100% Protegido LGPD
                    </span>
                  </div>

                  <div className="p-3 flex-1 overflow-y-auto max-h-80 font-mono text-xs">
                    {comparisonTab === 'headers' && (
                      <div className="space-y-1.5 divide-y divide-emerald-200/50 dark:divide-emerald-900/30">
                        {comparisonHeaders.sanitizedReq.length === 0 ? (
                          <div className="p-4 text-center text-zinc-500">Sem cabeçalhos restantes.</div>
                        ) : (
                          comparisonHeaders.sanitizedReq.map((h, i) => (
                            <div key={i} className="pt-1.5 first:pt-0 flex items-start justify-between gap-2 p-1">
                              <div className="min-w-0 flex-1 truncate">
                                <span className="font-bold text-emerald-800 dark:text-emerald-300">{h.name}:</span>{' '}
                                <span className="text-zinc-800 dark:text-zinc-300 break-all">{h.value}</span>
                              </div>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-medium uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                                Preservado
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {comparisonTab === 'body' && (
                      <div>
                        {comparisonBody.sanitized ? (
                          <pre className="text-emerald-900 dark:text-emerald-300 whitespace-pre-wrap break-all leading-relaxed bg-white/70 dark:bg-black/40 p-2.5 rounded border border-emerald-200 dark:border-emerald-950">
                            {comparisonBody.sanitized}
                          </pre>
                        ) : (
                          <div className="p-6 text-center text-zinc-500">Nenhum payload nesta requisição.</div>
                        )}
                      </div>
                    )}

                    {comparisonTab === 'url' && (
                      <div className="p-3 bg-white/70 dark:bg-black/40 rounded border border-emerald-200 dark:border-emerald-950 break-all leading-relaxed text-emerald-900 dark:text-emerald-300 font-semibold">
                        {comparisonUrl.sanitized}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 2: RULES CONFIGURATION ("MOSTRAR REGRAS") */}
      {viewMode === 'rules' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Headers Configuration */}
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Lock size={15} className="text-cyan-600 dark:text-cyan-400" />
                  Regras: Cabeçalhos a Remover ({headersToRemove.length})
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Cabeçalhos que serão expurgados das requisições e respostas antes do download.
              </p>

              <div className="flex flex-wrap gap-1.5 min-h-[60px]">
                {headersToRemove.map((header) => (
                  <span
                    key={header}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                  >
                    <span>{header}</span>
                    <button
                      onClick={() => setHeadersToRemove(headersToRemove.filter((h) => h !== header))}
                      className="text-zinc-400 hover:text-rose-500 transition"
                      title="Remover regra"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add custom header input */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <input
                  type="text"
                  placeholder="Adicionar header (ex: x-session-id)..."
                  value={customHeaderInput}
                  onChange={(e) => setCustomHeaderInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHeader()}
                  className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleAddHeader}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 transition"
                >
                  <Plus size={13} />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>

            {/* Body Keys Configuration */}
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Eye size={15} className="text-emerald-600 dark:text-emerald-400" />
                  Regras: Chaves do Body a Mascarar ({bodyKeysToRedact.length})
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Campos em payloads cujo valor será substituído por <code>"[REDACTED_LGPD]"</code>.
              </p>

              <div className="flex flex-wrap gap-1.5 min-h-[60px]">
                {bodyKeysToRedact.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                  >
                    <span>{key}</span>
                    <button
                      onClick={() => setBodyKeysToRedact(bodyKeysToRedact.filter((k) => k !== key))}
                      className="text-zinc-400 hover:text-rose-500 transition"
                      title="Remover chave"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add custom body key */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <input
                  type="text"
                  placeholder="Adicionar campo (ex: phone, rg, salary)..."
                  value={customBodyKeyInput}
                  onChange={(e) => setCustomBodyKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddBodyKey()}
                  className="flex-1 px-3 py-1.5 text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleAddBodyKey}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-1 transition"
                >
                  <Plus size={13} />
                  <span>Adicionar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Privacy Flags */}
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-3 shadow-2xs">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
              Flags de Higienização Global
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <input
                  type="checkbox"
                  checked={clearAllCookies}
                  onChange={(e) => setClearAllCookies(e.target.checked)}
                  className="rounded accent-cyan-600 w-4 h-4"
                />
                <span className="text-zinc-800 dark:text-zinc-200">Limpar todos os cookies</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <input
                  type="checkbox"
                  checked={redactQueryParams}
                  onChange={(e) => setRedactQueryParams(e.target.checked)}
                  className="rounded accent-cyan-600 w-4 h-4"
                />
                <span className="text-zinc-800 dark:text-zinc-200">Mascarar query strings</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <input
                  type="checkbox"
                  checked={redactBodies}
                  onChange={(e) => setRedactBodies(e.target.checked)}
                  className="rounded accent-cyan-600 w-4 h-4"
                />
                <span className="text-zinc-800 dark:text-zinc-200">Sanitizar corpos de JSON</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                <input
                  type="checkbox"
                  checked={anonymizeIps}
                  onChange={(e) => setAnonymizeIps(e.target.checked)}
                  className="rounded accent-cyan-600 w-4 h-4"
                />
                <span className="text-zinc-800 dark:text-zinc-200">Anonimizar IPs de servidor</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
