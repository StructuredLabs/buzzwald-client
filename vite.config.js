import { defineConfig } from 'vite'
import { resolve } from 'path'
import { execSync } from 'child_process'
import fs from 'fs'

// Plugin to generate version.json after build
function generateVersionPlugin() {
  return {
    name: 'generate-version',
    closeBundle() {
      // Generate version information
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      let commit = null;
      
      try {
        commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch (error) {
        console.warn('Could not get git commit hash');
      }
      
      const versionInfo = {
        version: packageJson.version,
        commit,
        timestamp: Date.now(),
        buildDate: new Date().toISOString(),
        buildId: `${packageJson.version}-${commit || 'unknown'}-${Date.now()}`,
        cacheBuster: `v=${packageJson.version}&t=${Date.now()}`
      };
      
      // Write version.json to dist
      fs.writeFileSync('dist/version.json', JSON.stringify(versionInfo, null, 2));
      console.log('✅ Generated version.json:', versionInfo);
    }
  }
}

export default defineConfig(({ mode }) => {
  const isWidget = process.env.BUILD_TARGET === 'widget';
  const isLoader = process.env.BUILD_TARGET === 'loader';
  
  // Default to widget build if no target specified
  const buildWidget = !isLoader;
  
  return {
    build: {
      lib: buildWidget ? {
        entry: resolve(__dirname, 'src/main.js'),
        name: 'Buzzwald',
        fileName: () => 'buzzwald-widget.js',
        formats: ['iife']
      } : undefined,
      rollupOptions: buildWidget ? {
        output: {
          name: 'Buzzwald',
          inlineDynamicImports: true
        }
      } : {
        // Loader build configuration
        input: resolve(__dirname, 'src/loader.js'),
        output: {
          dir: 'dist',
          entryFileNames: 'buzzwald.js',
          format: 'iife',
          name: 'BuzzwaldLoader'
        }
      },
      emptyOutDir: false // Don't clear dist when building loader
    },
    server: {
      open: '/test.html'
    },
    plugins: [generateVersionPlugin()]
  };
})
