import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    define: {
      // Pass environment variables to the app
      'import.meta.env.VITE_DFX_NETWORK': JSON.stringify(env.DFX_NETWORK || 'local'),
      'import.meta.env.VITE_BACKEND_CANISTER_ID': JSON.stringify(env.CANISTER_ID_BACKEND || ''),
    },
    // Ensure crypto polyfills work
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
  };
});
