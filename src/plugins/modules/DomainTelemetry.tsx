import React, { useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import { Globe } from 'lucide-react';

export const DomainTelemetry: React.FC<ToolPluginContext> = ({ entries }) => {
  const domainStats = useMemo(() => {
    const map = new Map<
      string,
      {
        domain: string;
        isThirdParty: boolean;
        isHttps: boolean;
        count: number;
        totalBytes: number;
        methods: Set<string>;
      }
    >();

    entries.forEach((e) => {
      const d = e.parsedUrl.hostname || 'desconhecido';
      const existing = map.get(d);
      const bytes = e.response.content?.size || e.response.bodySize || 0;

      if (existing) {
        existing.count++;
        existing.totalBytes += bytes;
        existing.methods.add(e.request.method);
      } else {
        map.set(d, {
          domain: d,
          isThirdParty: e.parsedUrl.isThirdParty,
          isHttps: e.parsedUrl.isHttps,
          count: 1,
          totalBytes: bytes,
          methods: new Set([e.request.method]),
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [entries]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto p-5 space-y-6 transition-colors">
      <div>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Globe className="text-cyan-600 dark:text-cyan-400" size={20} />
          Telemetria de Domínios, CDNs & Serviços Externos
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Mapeamento de dependências de terceiros, rastreadores e vazamento potencial de metadados para domínios externos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Domínios Únicos</div>
          <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1">
            {domainStats.length}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Endpoints de destino distintos</div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Domínios 3rd-Party</div>
          <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
            {domainStats.filter((d) => d.isThirdParty).length}
          </div>
          <div className="text-xs text-zinc-500 mt-1">Serviços fora do domínio de origem</div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-medium">Tráfego Criptografado (TLS)</div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
            {Math.round((domainStats.filter((d) => d.isHttps).length / (domainStats.length || 1)) * 100)}%
          </div>
          <div className="text-xs text-zinc-500 mt-1">Percentual com suporte HTTPS</div>
        </div>
      </div>

      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">
          Inventário de Domínios Conectados
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase text-[10px]">
                <th className="py-2 px-3">Domínio / Host</th>
                <th className="py-2 px-3">Classificação</th>
                <th className="py-2 px-3">Protocolo</th>
                <th className="py-2 px-3 text-right">Requisições</th>
                <th className="py-2 px-3 text-right">Volume de Dados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {domainStats.map((item, idx) => (
                <tr key={idx} className="hover:bg-zinc-100 dark:hover:bg-zinc-900/50 transition">
                  <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-200">{item.domain}</td>
                  <td className="py-2.5 px-3">
                    {item.isThirdParty ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                        3rd-Party / Externo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
                        1st-Party / Origem
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {item.isHttps ? (
                      <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">HTTPS (TLS)</span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-400 text-[11px] font-bold">HTTP (Inseguro)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-zinc-800 dark:text-zinc-300">{item.count}</td>
                  <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-zinc-400">{formatBytes(item.totalBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
