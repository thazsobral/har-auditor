import React, { useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import {
  KeyRound,
  Cookie as CookieIcon,
  ShieldAlert,
  Lock,
} from 'lucide-react';

export const AuthVault: React.FC<ToolPluginContext> = ({ entries, onSelectEntry }) => {
  const authHeaders = useMemo(() => {
    const list: Array<{
      entryId: string;
      url: string;
      method: string;
      headerName: string;
      value: string;
      type: string;
    }> = [];

    entries.forEach((entry) => {
      entry.request.headers.forEach((h) => {
        const name = h.name.toLowerCase();
        if (name === 'authorization' || name === 'x-api-key' || name === 'proxy-authorization') {
          let type = 'Custom Token';
          if (h.value.startsWith('Bearer ')) type = 'Bearer JWT/Token';
          else if (h.value.startsWith('Basic ')) type = 'Basic Auth (Base64)';
          list.push({
            entryId: entry.id,
            url: entry.request.url,
            method: entry.request.method,
            headerName: h.name,
            value: h.value,
            type,
          });
        }
      });
    });

    return list;
  }, [entries]);

  const cookieInventory = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        value: string;
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: string;
        seenInResponses: number;
        sampleUrl: string;
        entryId: string;
      }
    >();

    entries.forEach((entry) => {
      entry.response.cookies.forEach((c) => {
        const existing = map.get(c.name);
        if (existing) {
          existing.seenInResponses++;
        } else {
          map.set(c.name, {
            name: c.name,
            value: c.value,
            domain: c.domain || entry.parsedUrl.hostname,
            path: c.path || '/',
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite,
            seenInResponses: 1,
            sampleUrl: entry.request.url,
            entryId: entry.id,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [entries]);

  const queryTokenLeaks = useMemo(() => {
    const leaks: Array<{
      entryId: string;
      url: string;
      key: string;
      value: string;
    }> = [];

    entries.forEach((e) => {
      e.request.queryString.forEach((q) => {
        const k = q.name.toLowerCase();
        if (['token', 'auth', 'key', 'apikey', 'jwt', 'secret', 'password', 'bearer'].some((s) => k.includes(s))) {
          leaks.push({
            entryId: e.id,
            url: e.request.url,
            key: q.name,
            value: q.value,
          });
        }
      });
    });

    return leaks;
  }, [entries]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <KeyRound className="text-cyan-600 dark:text-cyan-400" size={20} />
          Cofre Forense: Auditoria de Autenticação e Credenciais
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Inspeção detalhada de tokens Bearer, chaves expostas em strings de consulta (URLs) e postura de cookies de sessão.
        </p>
      </div>

      {/* Query Leaks Section (Critical) */}
      {queryTokenLeaks.length > 0 && (
        <div className="p-4 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
              <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400" />
              <span>Vazamentos Críticos de Token em Parâmetros de URL (GET/Query)</span>
            </div>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-200 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
              {queryTokenLeaks.length} Ocorrências
            </span>
          </div>
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            Tokens enviados na URL são salvos em históricos de navegadores, logs de servidores Nginx/Apache/Cloudflare e no cabeçalho HTTP <code>Referer</code> quando links externos são clicados.
          </p>

          <div className="space-y-2 mt-2">
            {queryTokenLeaks.map((leak, idx) => (
              <div
                key={idx}
                onClick={() => onSelectEntry(leak.entryId)}
                className="p-3 bg-white dark:bg-zinc-900/80 rounded border border-rose-200 dark:border-rose-900/40 hover:border-rose-500 cursor-pointer transition text-xs font-mono shadow-xs"
              >
                <div className="flex justify-between items-center text-rose-700 dark:text-rose-400 font-semibold mb-1">
                  <span>Parâmetro: {leak.key}</span>
                  <span className="text-[11px] text-zinc-500 font-sans">Clique para inspecionar</span>
                </div>
                <div className="text-amber-800 dark:text-amber-300 break-all bg-amber-50 dark:bg-black/40 p-1.5 rounded border border-amber-200 dark:border-transparent">
                  {leak.key}={leak.value.length > 35 ? `${leak.value.slice(0, 30)}...` : leak.value}
                </div>
                <div className="text-zinc-500 text-[11px] mt-1 truncate">{leak.url}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authorization Headers Section */}
      <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-semibold text-sm">
            <Lock size={16} className="text-cyan-600 dark:text-cyan-400" />
            <span>Tokens de Autorização Detectados nos Headers HTTP</span>
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {authHeaders.length} Requisições Autenticadas
          </span>
        </div>

        {authHeaders.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-xs">
            Nenhum cabeçalho Authorization ou X-Api-Key encontrado nas requisições deste HAR.
          </div>
        ) : (
          <div className="space-y-2">
            {authHeaders.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onSelectEntry(item.entryId)}
                className="p-3 bg-white dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800 hover:border-cyan-500 cursor-pointer transition text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                      {item.type}
                    </span>
                    <span className="text-zinc-800 dark:text-zinc-300 font-bold">{item.headerName}</span>
                  </div>
                  <div className="text-zinc-500 dark:text-zinc-400 truncate text-[11px]">{item.url}</div>
                </div>
                <div className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-black/40 px-2 py-1 rounded max-w-sm truncate text-[11px] border border-zinc-200 dark:border-transparent">
                  {item.value.slice(0, 24)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cookie Posture Matrix */}
      <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200 font-semibold text-sm">
            <CookieIcon size={16} className="text-amber-500 dark:text-amber-400" />
            <span>Inventário de Cookies & Atributos de Proteção</span>
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {cookieInventory.length} Cookies Rastreados
          </span>
        </div>

        {cookieInventory.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-xs">
            Nenhum cabeçalho Set-Cookie identificado no arquivo HAR.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase text-[10px]">
                  <th className="py-2 px-3">Nome</th>
                  <th className="py-2 px-3">Domínio</th>
                  <th className="py-2 px-3 text-center">Secure</th>
                  <th className="py-2 px-3 text-center">HttpOnly</th>
                  <th className="py-2 px-3">SameSite</th>
                  <th className="py-2 px-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {cookieInventory.map((cookie, idx) => (
                  <tr key={idx} className="hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition">
                    <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-200">{cookie.name}</td>
                    <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400 text-[11px]">{cookie.domain}</td>
                    <td className="py-2.5 px-3 text-center">
                      {cookie.secure ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                          Inseguro
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {cookie.httpOnly ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          Sim
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                          Não (JS Acessível)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300 text-[11px]">{cookie.sameSite || 'None / Indefinido'}</td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => onSelectEntry(cookie.entryId)}
                        className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-sans text-xs underline font-medium"
                      >
                        Ver Requisição
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
