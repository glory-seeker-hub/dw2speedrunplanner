import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
// Separate production-mode QA build. Never added to the application entry or shipped bundle.
export default defineConfig({plugins:[react()],resolve:{alias:{'@':path.resolve(process.cwd(),'src')}},build:{outDir:'dist-ssr/route-qa',rollupOptions:{input:path.resolve(process.cwd(),'tests/route-preview.html')}}});
