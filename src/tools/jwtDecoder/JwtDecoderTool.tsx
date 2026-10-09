import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import {
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';

interface ExtractedJwt {
  id: string;
  source: 'Authorization Bearer' | 'URL Query Param' | 'Cookie' | 'Manual';
  location: string;
  entryId?: string;
  rawToken: string;
  header: Record<string, any>;
  payload: Record<string, any>;
  signature: string;
}

function decodeBase64Url(str: string): any {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(atob(str.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      return { raw: str };
    }
  }
}

function parseToken(raw: string, source: ExtractedJwt['source'], location: string, entryId?: string): ExtractedJwt | null {
  const clean = raw.trim().replace(/^Bearer\s+/i, '');
  const parts = clean.split('.');
  if (parts.length < 2) return null;

  try {
    const header = decodeBase64Url(parts[0]);
    const payload = decodeBase64Url(parts[1]);
    const signature = parts[2] || '';

    return {
      id: `${source}-${location}-${Math.random().toString(36).slice(2, 7)}`,
      source,
      location,
      entryId,
      rawToken: clean,
      header,
      payload,
      signature,
    };
  } catch {
    return null;
  }
}

export const JwtDecoderTool: React.FC<ToolPluginContext> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [selectedJwtId, setSelectedJwtId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Automatically harvest all JWTs in the HAR dataset
  const discoveredJwts = useMemo(() => {
    const list: ExtractedJwt[] = [];

    entries.forEach((entry) => {
      // 1. Authorization header
      entry.request.headers.forEach((h) => {
        if (h.name.toLowerCase() === 'authorization' && h.value.startsWith('Bearer ey')) {
          const parsed = parseToken(
            h.value,
            'Authorization Bearer',
            `Req #${entry.index + 1} (${entry.request.method} ${entry.parsedUrl.pathname})`,
            entry.id
          );
          if (parsed) list.push(parsed);
        }
      });

      // 2. Query Params
      entry.request.queryString.forEach((q) => {
        if (q.value.startsWith('ey') && q.value.includes('.')) {
          const parsed = parseToken(
            q.value,
            'URL Query Param',
            `Req #${entry.index + 1} (?${q.name}=)`,
            entry.id
          );
          if (parsed) list.push(parsed);
        }
      });

      // 3. Cookies
      entry.response.cookies.forEach((c) => {
        if (c.value.startsWith('ey') && c.value.includes('.')) {
          const parsed = parseToken(
            c.value,
            'Cookie',
            `Req #${entry.index + 1} (Cookie: ${c.name})`,
            entry.id
          );
          if (parsed) list.push(parsed);
        }
      });
    });

    return list;
  }, [entries]);

  // Handle manual input token
  const manualJwt = useMemo(() => {
    if (!manualInput.trim()) return null;
    return parseToken(manualInput, 'Manual', 'Entrada Manual');
  }, [manualInput]);

  // Combined list with manual token at top if available
  const allJwts = useMemo(() => {
    if (manualJwt) {
      return [manualJwt, ...discoveredJwts];
    }
    return discoveredJwts;
  }, [manualJwt, discoveredJwts]);

  // Active token to inspect
  const activeJwt = useMemo(() => {
    if (selectedJwtId) {
      const found = allJwts.find((j) => j.id === selectedJwtId);
      if (found) return found;
    }
    if (selectedEntryId) {
      const entryToken = allJwts.find((j) => j.entryId === selectedEntryId);
      if (entryToken) return entryToken;
    }
    return allJwts[0] || null;
  }, [allJwts, selectedJwtId, selectedEntryId]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getExpirationStatus = (payload: Record<string, any>) => {
    if (!payload || typeof payload.exp !== 'number') {
      return {
        status: 'no_exp',
        badge: 'Sem Expiração Definida',
        badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        detail: 'Risco de persistência perpétua caso o token não seja invalidado no servidor.',
        dateStr: 'Não informado',
      };
    }

    const expMs = payload.exp * 1000;
    const now = Date.now();
    const isExpired = expMs < now;
    const diffSeconds = Math.abs(Math.round((now - expMs) / 1000));
    const diffHours = (diffSeconds / 3600).toFixed(1);
    const dateStr = new Date(expMs).toLocaleString('pt-BR');

    if (isExpired) {
      return {
        status: 'expired',
        badge: 'TOKEN EXPIRADO',
        badgeClass: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold',
        detail: `Expirou há ${diffHours} horas em ${dateStr}.`,
        dateStr,
      };
    }

    return {
      status: 'valid',
      badge: 'TOKEN VÁLIDO',
      badgeClass: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold',
      detail: `Válido por mais ${diffHours} horas até ${dateStr}.`,
      dateStr,
    };
  };

  const expInfo = activeJwt ? getExpirationStatus(activeJwt.payload) : null;

  return (
    <div className="flex flex-col h-full bg-zinc-50/70 dark:bg-zinc-950 overflow-hidden transition-colors font-sans">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <KeyRound className="text-cyan-600 dark:text-cyan-400" size={22} />
            Decodificador & Inspetor Forense de JWT
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Decodificação em tempo real de tokens Bearer, parâmetros de autenticação e validação temporal de expiração.
          </p>
        </div>

        {expInfo && (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-md text-xs font-mono border ${expInfo.badgeClass}`}>
              {expInfo.badge}
            </span>
          </div>
        )}
      </div>

      {/* Main split canvas */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Discovered Tokens list + Manual Paste */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 flex flex-col overflow-hidden">
          {/* Manual Input field */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/20">
            <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
              Colar Token JWT Manual
            </label>
            <textarea
              placeholder="Cole aqui: eyJhbGciOiJIUzI1NiIs..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              rows={2}
              className="w-full p-2 text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-md text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-cyan-500 resize-none shadow-2xs"
            />
          </div>

          {/* Tokens harvested list header */}
          <div className="px-3 py-2 bg-zinc-100/90 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex justify-between items-center">
            <span>Tokens Encontrados ({allJwts.length})</span>
            {selectedEntryId && <span className="text-cyan-700 dark:text-cyan-400 font-mono">Foco Req Selecionada</span>}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/60 text-xs">
            {allJwts.length === 0 ? (
              <div className="p-6 text-center text-zinc-400 dark:text-zinc-500">
                Nenhum token JWT identificado no arquivo HAR carregado.
              </div>
            ) : (
              allJwts.map((item) => {
                const isSelected = activeJwt?.id === item.id;
                const itemExp = getExpirationStatus(item.payload);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedJwtId(item.id)}
                    className={`p-3 cursor-pointer transition space-y-1 select-none ${
                      isSelected
                        ? 'bg-cyan-50/90 dark:bg-cyan-950/40 border-l-4 border-l-cyan-600 dark:border-l-cyan-400'
                        : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-200 text-xs">
                        {item.source}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                          itemExp.status === 'expired'
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                            : itemExp.status === 'valid'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        {itemExp.status === 'expired' ? 'Expirado' : itemExp.status === 'valid' ? 'Válido' : 'Sem Exp'}
                      </span>
                    </div>

                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {item.location}
                    </div>

                    <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                      {item.rawToken.slice(0, 24)}...
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Area: Token Forensic Breakdown */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-zinc-50/40 dark:bg-zinc-950">
          {!activeJwt ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400">
              <KeyRound size={48} className="text-zinc-300 dark:text-zinc-700 mb-3" />
              <h3 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">Nenhum token selecionado</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Selecione uma das requisições na barra lateral ou cole um token JWT na caixa de texto.
              </p>
            </div>
          ) : (
            <>
              {/* Expiration and Context Card */}
              <div
                className={`p-4 rounded-lg border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  expInfo?.status === 'expired'
                    ? 'bg-rose-50/90 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/60'
                    : expInfo?.status === 'valid'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/60'
                    : 'bg-amber-50/90 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {expInfo?.status === 'expired' ? (
                      <AlertTriangle className="text-rose-600 dark:text-rose-400" size={18} />
                    ) : (
                      <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={18} />
                    )}
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      Diagnóstico de Validade do Token
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">{expInfo?.detail}</p>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    Local de Captura: {activeJwt.location}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeJwt.entryId && (
                    <button
                      onClick={() => onSelectEntry(activeJwt.entryId!)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-zinc-900 text-cyan-700 dark:text-cyan-400 border border-zinc-300 dark:border-zinc-800 hover:border-cyan-500 transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>Inspecionar Requisição</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => copyToClipboard(activeJwt.rawToken, 'raw-token')}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 transition flex items-center gap-1.5 shadow-2xs"
                  >
                    {copiedKey === 'raw-token' ? <Check size={13} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={13} />}
                    <span>Copiar Token Raw</span>
                  </button>
                </div>
              </div>

              {/* Claims Breakdown Matrix */}
              <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-3 shadow-xs">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 block">
                  Claims Principais Identificados (Standard JWT)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase block font-semibold">exp (Expiration)</span>
                    <span className="text-zinc-900 dark:text-zinc-200 font-bold">{activeJwt.payload.exp ? expInfo?.dateStr : 'Ausente'}</span>
                  </div>

                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase block font-semibold">iat (Issued At)</span>
                    <span className="text-zinc-900 dark:text-zinc-200 font-bold">
                      {activeJwt.payload.iat ? new Date(activeJwt.payload.iat * 1000).toLocaleString('pt-BR') : 'Ausente'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase block font-semibold">alg (Algorithm)</span>
                    <span className="text-cyan-700 dark:text-cyan-400 font-bold">{activeJwt.header.alg || 'Desconhecido'}</span>
                  </div>

                  {activeJwt.payload.sub && (
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase block font-semibold">sub (Subject / ID)</span>
                      <span className="text-zinc-900 dark:text-zinc-200 font-bold truncate block">{String(activeJwt.payload.sub)}</span>
                    </div>
                  )}

                  {activeJwt.payload.iss && (
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase block font-semibold">iss (Issuer)</span>
                      <span className="text-zinc-900 dark:text-zinc-200 font-bold truncate block">{String(activeJwt.payload.iss)}</span>
                    </div>
                  )}

                  {activeJwt.payload.aud && (
                    <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase block font-semibold">aud (Audience)</span>
                      <span className="text-zinc-900 dark:text-zinc-200 font-bold truncate block">{String(activeJwt.payload.aud)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* JSON Panels: Header & Payload with Theme-reactive Header Bars */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                {/* Header Section */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-xs flex flex-col">
                  <div className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-zinc-800 dark:text-zinc-200 font-sans font-semibold text-xs">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Cabeçalho (HEADER: Algorithm & Token Type)</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(activeJwt.header, null, 2), 'header-json')}
                      className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-[11px] font-sans"
                    >
                      {copiedKey === 'header-json' ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="p-3 text-cyan-900 dark:text-cyan-300 overflow-x-auto flex-1 max-h-60 bg-zinc-50/70 dark:bg-zinc-950">
                    {JSON.stringify(activeJwt.header, null, 2)}
                  </pre>
                </div>

                {/* Payload Section */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-xs flex flex-col">
                  <div className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center text-zinc-800 dark:text-zinc-200 font-sans font-semibold text-xs">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Carga Útil (PAYLOAD: Data Claims)</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(activeJwt.payload, null, 2), 'payload-json')}
                      className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-[11px] font-sans"
                    >
                      {copiedKey === 'payload-json' ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="p-3 text-emerald-900 dark:text-emerald-300 overflow-x-auto flex-1 max-h-80 bg-zinc-50/70 dark:bg-zinc-950">
                    {JSON.stringify(activeJwt.payload, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Signature Preview */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
                <div className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-sans font-semibold text-xs">
                  Assinatura Criptográfica (SIGNATURE)
                </div>
                <div className="p-3 text-xs font-mono text-zinc-600 dark:text-zinc-400 break-all bg-zinc-50/70 dark:bg-zinc-950">
                  {activeJwt.signature || '[Nenhuma assinatura anexada ou token inseguro alg: none]'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
