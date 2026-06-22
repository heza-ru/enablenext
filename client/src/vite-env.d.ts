/// <reference types="vite/client" />

// PptxGenJS loaded dynamically from /libs/pptxgen.bundle.js
interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PptxGenJS?: any;
}

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOGGER: string;
  readonly VITE_LOGGER_FILTER: string;
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
