import type { ReactNode, ComponentType } from 'react';
import type { HarRoot, HarMetrics, EnrichedHarEntry } from './har.ts';

export type PluginCategory =
  | 'overview'
  | 'security'
  | 'network'
  | 'auth'
  | 'performance'
  | 'privacy';

export interface ToolPluginContext {
  har: HarRoot | null;
  metrics: HarMetrics;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
  entries: EnrichedHarEntry[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export interface ToolPlugin {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  category: PluginCategory;
  /**
   * Lucide icon component or custom React component
   */
  icon: ComponentType<{ className?: string; size?: number | string }>;
  /**
   * Calculate alert / issue badge count dynamically based on the parsed HAR
   */
  getAlertCount?: (metrics: HarMetrics, entries: EnrichedHarEntry[]) => number;
  /**
   * Badge color intent
   */
  badgeVariant?: 'danger' | 'warning' | 'info' | 'neutral';
  /**
   * Main render function of the tool module
   */
  render: (context: ToolPluginContext) => ReactNode;
}

export interface ToolRegistry {
  register: (plugin: ToolPlugin) => void;
  unregister: (pluginId: string) => void;
  get: (pluginId: string) => ToolPlugin | undefined;
  getAll: () => ToolPlugin[];
  getByCategory: (category: PluginCategory) => ToolPlugin[];
}
