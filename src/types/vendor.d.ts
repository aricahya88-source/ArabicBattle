declare module 'playcanvas';
declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string): any;
}
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly PROD: boolean;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
