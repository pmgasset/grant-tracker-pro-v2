/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_CLOUDFLARE_ACCOUNT_ID: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_GRANTS_GOV_API_KEY: string
  readonly VITE_FOUNDATION_DIRECTORY_API_KEY: string
  readonly VITE_ENABLE_OFFLINE_MODE: string
  readonly VITE_ENABLE_PWA: string
  readonly VITE_ENABLE_ANALYTICS: string
  readonly VITE_DEBUG_MODE: string
  readonly VITE_DEV_API_URL: string
  readonly VITE_MOCK_API_RESPONSES: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}