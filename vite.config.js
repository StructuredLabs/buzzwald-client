import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.js'),
      name: 'Buzzwald',
      fileName: (format) => `widget.${format}.js`,
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        // Ensure the IIFE is named properly for global access
        name: 'Buzzwald',
        // Inline all dependencies to create a single file
        inlineDynamicImports: true
      }
    },
    // Create a clean dist directory
    emptyOutDir: true
  },
  // For development, serve the widget with a test page
  server: {
    open: '/test.html'
  }
})