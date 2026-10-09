import React, { useState, useMemo } from 'react';
import type { ToolPluginContext } from '../../types/plugin.ts';
import type { EnrichedHarEntry } from '../../types/har.ts';
import {
  FileCode,
  Copy,
  Check,
  Download,
  CheckCircle2,
  Code2,
  Terminal,
  Layers,
  Sparkles,
} from 'lucide-react';

export type MockTarget = 'msw' | 'cypress' | 'playwright' | 'postman';

export const MockExporterTool: React.FC<ToolPluginContext> = ({ entries }) => {
  const [selectedTarget, setSelectedTarget] = useState<MockTarget>('msw');
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(
    new Set(entries.slice(0, 5).map((e) => e.id))
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Toggle selection
  const handleToggleEntry = (id: string) => {
    const next = new Set(selectedEntryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntryIds(next);
  };

  const handleSelectAll = () => {
    setSelectedEntryIds(new Set(entries.map((e) => e.id)));
  };

  const handleClearSelection = () => {
    setSelectedEntryIds(new Set());
  };

  // Selected entries
  const selectedEntries = useMemo(() => {
    return entries.filter((e) => selectedEntryIds.has(e.id));
  }, [entries, selectedEntryIds]);

  // Code generator for MSW (Mock Service Worker v2)
  const generateMswCode = (items: EnrichedHarEntry[]): string => {
    const handlers = items.map((e) => {
      const method = e.request.method.toLowerCase();
      const path = e.parsedUrl.pathname;
      const status = e.response.status || 200;
      let bodyData = '{}';
      try {
        if (e.response.content?.text) {
          const parsed = JSON.parse(e.response.content.text);
          bodyData = JSON.stringify(parsed, null, 2);
        }
      } catch {
        bodyData = JSON.stringify({ raw: e.response.content?.text || '' });
      }

      return `  // ${e.request.method} ${e.request.url}
  http.${method}('*${path}', () => {
    return HttpResponse.json(
${bodyData.split('\n').map((line) => '      ' + line).join('\n')},
      { status: ${status} }
    );
  }),`;
    });

    return `import { http, HttpResponse } from 'msw';

export const handlers = [
${handlers.join('\n\n')}
];
`;
  };

  // Code generator for Cypress
  const generateCypressCode = (items: EnrichedHarEntry[]): string => {
    const intercepts = items.map((e, idx) => {
      const method = e.request.method.toUpperCase();
      const path = e.parsedUrl.pathname;
      const status = e.response.status || 200;
      let bodyData = '{}';
      try {
        if (e.response.content?.text) {
          const parsed = JSON.parse(e.response.content.text);
          bodyData = JSON.stringify(parsed, null, 2);
        }
      } catch {
        bodyData = JSON.stringify({ raw: e.response.content?.text || '' });
      }

      return `  // Mock #${idx + 1}: ${method} ${path}
  cy.intercept('${method}', '**${path}*', {
    statusCode: ${status},
    body: ${bodyData},
  }).as('mock_${method.toLowerCase()}_${idx + 1}');`;
    });

    return `describe('Mocks Gerados via HAR Auditor', () => {
  beforeEach(() => {
${intercepts.join('\n\n')}
  });

  it('deve carregar com mocks ativos', () => {
    cy.visit('/');
  });
});
`;
  };

  // Code generator for Playwright
  const generatePlaywrightCode = (items: EnrichedHarEntry[]): string => {
    const routes = items.map((e, idx) => {
      const method = e.request.method.toUpperCase();
      const path = e.parsedUrl.pathname;
      const status = e.response.status || 200;
      let bodyData = '{}';
      try {
        if (e.response.content?.text) {
          const parsed = JSON.parse(e.response.content.text);
          bodyData = JSON.stringify(parsed, null, 2);
        }
      } catch {
        bodyData = JSON.stringify({ raw: e.response.content?.text || '' });
      }

      return `  // Mock #${idx + 1}: ${method} ${path}
  await page.route('**${path}*', async (route) => {
    if (route.request().method() === '${method}') {
      await route.fulfill({
        status: ${status},
        contentType: '${e.response.content?.mimeType || 'application/json'}',
        body: JSON.stringify(${bodyData}),
      });
    } else {
      await route.continue();
    }
  });`;
    });

    return `import { test, expect } from '@playwright/test';

test('executa com mocks gerados do HAR', async ({ page }) => {
${routes.join('\n\n')}

  await page.goto('/');
});
`;
  };

  // Code generator for Postman Collection v2.1.0
  const generatePostmanCollection = (items: EnrichedHarEntry[]): string => {
    const postmanItems = items.map((e, idx) => {
      let hostParts: string[] = [];
      let pathParts: string[] = [];
      try {
        const u = new URL(e.request.url);
        hostParts = u.hostname.split('.');
        pathParts = u.pathname.split('/').filter(Boolean);
      } catch {
        pathParts = [e.request.url];
      }

      const headers = (e.request.headers || []).map((h) => ({
        key: h.name,
        value: h.value,
        type: 'text',
      }));

      const responses = [
        {
          name: `${e.response.status} ${e.response.statusText || 'OK'}`,
          originalRequest: {
            method: e.request.method,
            header: headers,
            url: {
              raw: e.request.url,
              protocol: e.parsedUrl.protocol.replace(':', ''),
              host: hostParts,
              path: pathParts,
            },
          },
          status: e.response.statusText || 'OK',
          code: e.response.status,
          _postman_previewlanguage: 'json',
          header: (e.response.headers || []).map((h) => ({
            key: h.name,
            value: h.value,
          })),
          body: e.response.content?.text || '',
        },
      ];

      return {
        name: `[#${idx + 1}] ${e.request.method} ${e.parsedUrl.pathname}`,
        request: {
          method: e.request.method,
          header: headers,
          url: {
            raw: e.request.url,
            protocol: e.parsedUrl.protocol.replace(':', ''),
            host: hostParts,
            path: pathParts,
          },
          description: `Gerado a partir do HAR Auditor em ${new Date().toISOString()}`,
        },
        response: responses,
      };
    });

    const collection = {
      info: {
        _postman_id: `col-${Date.now()}`,
        name: 'Export HAR Auditor Mocks',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: postmanItems,
    };

    return JSON.stringify(collection, null, 2);
  };

  // Generated code output
  const generatedCode = useMemo(() => {
    if (selectedEntries.length === 0) {
      return '// Selecione ao menos uma requisição na lista à esquerda para gerar mocks.';
    }

    switch (selectedTarget) {
      case 'msw':
        return generateMswCode(selectedEntries);
      case 'cypress':
        return generateCypressCode(selectedEntries);
      case 'playwright':
        return generatePlaywrightCode(selectedEntries);
      case 'postman':
        return generatePostmanCollection(selectedEntries);
    }
  }, [selectedEntries, selectedTarget]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedKey('copied');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadMockFile = () => {
    let filename = 'mocks.ts';
    let mimeType = 'text/typescript';

    if (selectedTarget === 'cypress') filename = 'cypress-intercepts.cy.ts';
    else if (selectedTarget === 'playwright') filename = 'playwright.spec.ts';
    else if (selectedTarget === 'postman') {
      filename = 'postman-collection.json';
      mimeType = 'application/json';
    }

    const blob = new Blob([generatedCode], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50/60 dark:bg-zinc-950 overflow-hidden transition-colors font-sans">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Code2 className="text-cyan-600 dark:text-cyan-400" size={22} />
            Exportador de Mocks: MSW, Cypress, Playwright & Postman
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Converta requisições reais do tráfego gravado em mocks prontos para testes E2E e desenvolvimento frontend offline.
          </p>
        </div>

        {/* Target Format Tabs */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-300 dark:border-zinc-800 text-xs">
          {[
            { id: 'msw', label: 'MSW (Mock Service Worker)' },
            { id: 'cypress', label: 'Cypress (cy.intercept)' },
            { id: 'playwright', label: 'Playwright (page.route)' },
            { id: 'postman', label: 'Postman Collection v2.1' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedTarget(item.id as MockTarget)}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                selectedTarget === item.id
                  ? 'bg-white dark:bg-zinc-800 text-cyan-700 dark:text-cyan-300 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout: Request Selector on Left + Code View on Right */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Column: Selection Checklist */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 flex flex-col overflow-hidden">
          {/* Action selection header */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Selecionadas ({selectedEntries.length} de {entries.length})
            </span>
            <div className="flex gap-2 text-xs">
              <button
                onClick={handleSelectAll}
                className="text-cyan-700 dark:text-cyan-400 hover:underline font-medium"
              >
                Todas
              </button>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <button
                onClick={handleClearSelection}
                className="text-zinc-500 hover:underline"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* List of selectable requests */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/60 text-xs font-mono">
            {entries.map((entry) => {
              const isChecked = selectedEntryIds.has(entry.id);

              return (
                <label
                  key={entry.id}
                  className={`p-3 flex items-start gap-2.5 cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition select-none ${
                    isChecked ? 'bg-cyan-50/50 dark:bg-cyan-950/20' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleEntry(entry.id)}
                    className="mt-0.5 rounded accent-cyan-600 w-4 h-4 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-bold text-cyan-700 dark:text-cyan-400">
                        {entry.request.method}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        Status {entry.response.status}
                      </span>
                    </div>
                    <div className="text-zinc-800 dark:text-zinc-200 truncate text-[11px]" title={entry.request.url}>
                      {entry.parsedUrl.pathname}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Right Column: Code Viewer with Copy & Download */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50/40 dark:bg-zinc-950">
          {/* Code Toolbar */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/80 flex items-center justify-between text-xs font-sans">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold">
              <Terminal size={14} className="text-cyan-600 dark:text-cyan-400" />
              <span>
                Mock Gerado ({selectedEntries.length} endpoints mapeados para {selectedTarget.toUpperCase()})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 transition flex items-center gap-1.5 shadow-2xs"
              >
                {copiedKey === 'copied' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>Copiar Código</span>
              </button>

              <button
                onClick={downloadMockFile}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center gap-1.5 shadow-xs"
              >
                <Download size={13} />
                <span>Baixar Arquivo</span>
              </button>
            </div>
          </div>

          {/* Code Editor Preview */}
          <div className="flex-1 overflow-auto p-4 bg-zinc-900 text-zinc-100 font-mono text-xs leading-relaxed">
            <pre className="whitespace-pre overflow-x-auto selection:bg-cyan-500/30">
              {generatedCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
