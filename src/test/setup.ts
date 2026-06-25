// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// and registers their TypeScript types via the side-effect import.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Unmount React trees between tests so the jsdom DOM stays isolated.
afterEach(() => {
  cleanup()
})
