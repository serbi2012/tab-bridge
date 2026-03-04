import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'react/index': 'src/react/index.ts',
    'zustand/index': 'src/zustand/index.ts',
    'jotai/index': 'src/jotai/index.ts',
    'redux/index': 'src/redux/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  treeshake: true,
  splitting: true,
  external: ['react', 'zustand', 'zustand/vanilla', 'jotai', 'jotai/vanilla', 'redux', '@reduxjs/toolkit'],
  outDir: 'dist',
});
