import React from 'react';
import { useHarStore } from '../../store/useHarStore.ts';
import { toolRegistry } from '../../plugins/ToolRegistry.ts';
import {
  Menu,
  ChevronLeft,
  Shield,
  Trash2,
  Sparkles,
  Lock,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeToolId,
    setActiveTool,
    sidebarCollapsed,
    toggleSidebar,
    metrics,
    entries,
    har,
    loadSampleHar,
    clearFile,
  } = useHarStore();

  const plugins = toolRegistry.getAll();

  const getBadgeClass = (variant?: 'danger' | 'warning' | 'info' | 'neutral') => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-100 dark:bg-rose-950/90 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/80';
      case 'warning':
        return 'bg-amber-100 dark:bg-amber-950/90 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/80';
      case 'info':
        return 'bg-cyan-100 dark:bg-cyan-950/90 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800/80';
      default:
        return 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
    }
  };

  return (
    <aside
      className={`relative z-20 flex flex-col bg-slate-50/95 dark:bg-zinc-900/90 border-r border-slate-200/90 dark:border-zinc-800 backdrop-blur-md transition-all duration-300 ease-in-out select-none ${
        sidebarCollapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Sidebar Header / Brand & Toggle */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-slate-200/90 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/50">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden pl-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 dark:shadow-cyan-950/50 flex-shrink-0">
              <Shield size={18} className="text-white dark:text-zinc-950" />
            </div>
            <div className="flex flex-col truncate">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs tracking-wider text-zinc-900 dark:text-zinc-100 font-mono">
                  har-auditor
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono tracking-wide bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800">
                  BETA
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans truncate">
                Forensic Security Suite
              </span>
            </div>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="mx-auto">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              title="Expandir Menu"
            >
              <Menu size={18} />
            </button>
          </div>
        )}

        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            title="Recolher Menu (Hambúrguer)"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1.5">
        {!sidebarCollapsed && (
          <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
            Módulos de Investigação
          </div>
        )}

        {plugins.map((plugin) => {
          const isActive = activeToolId === plugin.id;
          const IconComponent = plugin.icon;
          const alertCount = har && plugin.getAlertCount ? plugin.getAlertCount(metrics, entries) : 0;
          const badgeStyle = getBadgeClass(plugin.badgeVariant);

          return (
            <button
              key={plugin.id}
              onClick={() => setActiveTool(plugin.id)}
              title={sidebarCollapsed ? `${plugin.name} ${alertCount > 0 ? `(${alertCount})` : ''}` : undefined}
              className={`group relative flex items-center w-full rounded-lg transition-all text-left ${
                sidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 gap-3'
              } ${
                isActive
                  ? 'bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-800/60 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 border border-transparent'
              }`}
            >
              <div className="relative flex-shrink-0">
                <IconComponent
                  size={18}
                  className={`transition-colors ${
                    isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200'
                  }`}
                />
                {/* Minimized alert badge indicator */}
                {sidebarCollapsed && alertCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-mono font-bold bg-rose-600 text-white shadow-xs ring-1 ring-white dark:ring-zinc-950">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </div>

              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
                  <div className="truncate">
                    <div className="text-xs font-medium text-zinc-800 dark:text-zinc-100 group-hover:text-zinc-950 dark:group-hover:text-white truncate">
                      {plugin.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                      {plugin.shortName || plugin.category}
                    </div>
                  </div>

                  {alertCount > 0 && (
                    <span
                      className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeStyle}`}
                    >
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Sidebar Footer Actions */}
      <div className="p-2 border-t border-slate-200/90 dark:border-zinc-800/80 bg-slate-100/70 dark:bg-zinc-950/60 space-y-2">
        {!har && !sidebarCollapsed && (
          <button
            onClick={loadSampleHar}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs font-medium bg-cyan-600/10 hover:bg-cyan-600/20 dark:bg-cyan-900/40 dark:hover:bg-cyan-800/50 text-cyan-700 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700/50 transition"
          >
            <Sparkles size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span className="truncate">Carregar Amostra HAR</span>
          </button>
        )}

        {har && !sidebarCollapsed && (
          <button
            onClick={clearFile}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/40 transition"
          >
            <Trash2 size={14} />
            <span>Fechar Arquivo Atual</span>
          </button>
        )}

        {sidebarCollapsed && har && (
          <button
            onClick={clearFile}
            title="Fechar Arquivo"
            className="flex items-center justify-center w-full p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
          >
            <Trash2 size={16} />
          </button>
        )}

        {!sidebarCollapsed && (
          <div className="pt-1 px-1 text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 justify-center">
            <Lock size={10} className="text-emerald-600 dark:text-emerald-500" />
            <span>100% Processamento Local</span>
          </div>
        )}
      </div>
    </aside>
  );
};
