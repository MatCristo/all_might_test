import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /* The pure-function tests need nothing, but the ones that mount a component
     need a DOM. jsdom for everything is simpler than splitting the suite in
     two, and costs a few hundred milliseconds. */
  test: {
    /* The panel is read in Brazil, and the laudos timestamps are BRT
       wall-clock stored as UTC — what the screen prints only matches what the
       clinic recorded in this zone, so the suite pins it instead of inheriting
       the runner's (UTC on CI, BRT on a local machine). */
    env: { TZ: 'America/Sao_Paulo' },
    environment: 'jsdom',
    /* The panel imports the router under both of its spellings, and
       react-router-dom v7 is a re-export of react-router. Under the runner's
       node resolution the two come back as separate module instances — two
       copies of the router context, so a page that took useNavigate from one
       spelling could not see the <MemoryRouter> a test built from the other.
       Pointing one at the other is what the bundler ends up doing anyway. */
    alias: { 'react-router-dom': 'react-router' },
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    restoreMocks: true,
  },
})
