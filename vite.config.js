import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    if (!/^https:\/\/[a-z0-9.-]+\/?$/i.test(env.VITE_SUPABASE_URL || '') ||
        !/^sb_publishable_[a-z0-9_-]+$/i.test(env.VITE_SUPABASE_PUBLISHABLE_KEY || '')) {
      throw new Error('A production build requires VITE_SUPABASE_URL and a Supabase publishable key.');
    }
  }

  return { base: './' };
});
