import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname, '..');
  const env = {
    ...loadEnv(mode, rootDir, ''),
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env
  };

  const serverHost = env.VITE_DOMAIN || env.DOMAIN || env.VITE_SERVER_IP || env.SERVER_IP || env.VITE_HOST || env.HOST || 'localhost';
  const serverPort = env.VITE_BACKEND_PORT || env.BACKEND_PORT || env.PORT || '8000';
  const protocol = env.VITE_PROTOCOL || env.PROTOCOL || 'http';

  let backendUrl = env.VITE_BACKEND_URL || env.BACKEND_URL;
  if (!backendUrl) {
    if (serverHost.startsWith('http://') || serverHost.startsWith('https://')) {
      backendUrl = serverHost;
    } else {
      backendUrl = `${protocol}://${serverHost}:${serverPort}`;
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    envDir: rootDir,
    define: {
      'import.meta.env.VITE_SERVER_IP': JSON.stringify(env.VITE_SERVER_IP || env.SERVER_IP || ''),
      'import.meta.env.VITE_DOMAIN': JSON.stringify(env.VITE_DOMAIN || env.DOMAIN || ''),
      'import.meta.env.VITE_API_BASE': JSON.stringify(env.VITE_API_BASE || ''),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || env.BACKEND_URL || '')
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true
        },
        '/assets': {
          target: backendUrl,
          changeOrigin: true
        }
      }
    }
  };
});
