import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { env: { NODE_ENV: 'test', DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/hospital_test', UPLOAD_DIR: '/tmp/seh-test-uploads' }, testTimeout: 20000, hookTimeout: 30000, fileParallelism: false } });
