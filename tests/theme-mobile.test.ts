import assert from 'node:assert/strict'
import { test } from 'node:test'
import { siteSettingsSchema } from '../shared/schemas/settings'
import { effectiveTheme } from '../shared/theme'
import { messages, translate, translationKeys } from '../shared/i18n'

const legacy = { name: 'Directory', navigation: [], seo: {} }

test('legacy settings get mobile shortcuts and a system theme without overwriting explicit empty tabs', () => {
  const settings = siteSettingsSchema.parse(legacy)
  assert.deepEqual(settings.mobileTabs.map(tab => tab.to), ['/', '/search', '/submit'])
  assert.deepEqual(settings.theme, { defaultMode: 'system', accent: 'blue' })
  assert.deepEqual(siteSettingsSchema.parse({ ...legacy, mobileTabs: [] }).mobileTabs, [])
})

test('mobile tabs validate maximum size, labels and safe destinations', () => {
  const tab = { label: 'Search', to: '/search' }
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, mobileTabs: Array(5).fill(tab) }).success, true)
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, mobileTabs: Array(6).fill(tab) }).success, false)
  for (const to of ['javascript:alert(1)', '//example.com', '/\\example.com', 'data:text/html,test']) {
    assert.equal(siteSettingsSchema.safeParse({ ...legacy, mobileTabs: [{ ...tab, to }] }).success, false)
  }
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, mobileTabs: [{ ...tab, label: '' }] }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, mobileTabs: [{ ...tab, to: 'https://example.com/path' }] }).success, true)
})

test('site theme defaults apply only without a valid visitor override', () => {
  for (const mode of ['light', 'dark', 'system'] as const) {
    assert.equal(effectiveTheme(undefined, mode), mode)
    assert.equal(effectiveTheme('invalid', mode), mode)
    for (const override of ['light', 'dark', 'system'] as const) assert.equal(effectiveTheme(override, mode), override)
  }
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, theme: { accent: '#123456' } }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, theme: { defaultMode: 'auto' } }).success, false)
})

test('shared public control dictionaries have matching translation keys', () => {
  for (const group of ['nav', 'home', 'common'] as const) {
    assert.deepEqual(Object.keys(messages['zh-CN'][group]).sort(), Object.keys(messages['en-US'][group]).sort())
  }
})

test('translation overrides are bounded to existing built-in keys and merge by locale', () => {
  const settings = siteSettingsSchema.parse({ ...legacy, translations: [{ key: 'common.description', zhCN: '站点说明', enUS: 'Site description' }] })
  assert.equal(settings.translations[0]!.key, 'common.description')
  assert.equal(translate('zh-CN', 'common.description', settings.translations), '站点说明')
  assert.equal(translate('en-US', 'common.description', settings.translations), 'Site description')
  assert.equal(translate('en-US', 'nav.home', settings.translations), 'Home')
  assert.equal(translate('en-US', 'missing.key', settings.translations), 'missing.key')
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, translations: [...settings.translations, ...settings.translations] }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, translations: [{ key: 'common.description', zhCN: ' ', enUS: 'x' }] }).success, false)
  for (const key of translationKeys) assert.notEqual(translate('en-US', key), key)
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, translations: [{ key: 'common.notAKey', zhCN: 'x', enUS: 'x' }] }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, translations: Array(81).fill({ key: 'common.description', zhCN: 'x', enUS: 'x' }) }).success, false)
  assert.equal(siteSettingsSchema.safeParse({ ...legacy, translations: [{ key: 'common.description', zhCN: 'x'.repeat(241), enUS: 'x' }] }).success, false)
})
