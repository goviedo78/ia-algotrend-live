import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const bannerUrl = new URL('../src/components/SponsorBanner.tsx', import.meta.url)

test('SponsorBanner has dedicated mobile content and preserves a desktop variant', async () => {
  const source = await readFile(bannerUrl, 'utf8')

  assert.match(source, /sm:hidden/)
  assert.match(source, /hidden[^"\n]*sm:flex/)
  assert.match(source, /IA ALGOTREND/)
  assert.match(source, /SMART AI TREND DETECTION/)
  assert.match(source, /https:\/\/gonovi\.gumroad\.com\/l\/ia/)
})
