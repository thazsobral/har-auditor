/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { initializeDefaultPlugins } from './plugins/defaultPlugins.ts';
import { AppLayout } from './components/layout/AppLayout.tsx';

// Initialize central plugin registry
initializeDefaultPlugins();

export default function App() {
  return <AppLayout />;
}
