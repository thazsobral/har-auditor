import type { ToolPlugin, PluginCategory, ToolRegistry } from '../types/plugin.ts';

class CentralToolRegistry implements ToolRegistry {
  private plugins: Map<string, ToolPlugin> = new Map();

  register(plugin: ToolPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  get(pluginId: string): ToolPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAll(): ToolPlugin[] {
    return Array.from(this.plugins.values());
  }

  getByCategory(category: PluginCategory): ToolPlugin[] {
    return this.getAll().filter((p) => p.category === category);
  }
}

export const toolRegistry = new CentralToolRegistry();
