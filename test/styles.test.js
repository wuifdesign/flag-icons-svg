import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import * as sass from 'sass'
import less from 'less'

const root = path.join(import.meta.dirname, '..')
// svg files that exist but are intentionally not (yet) exposed as flag classes
const { unlisted: unlistedSvgs } = JSON.parse(fs.readFileSync(path.join(root, 'flags.json'), 'utf8'))
const svgCodes = fs
  .readdirSync(path.join(root, 'svg'))
  .filter((file) => file.endsWith('.svg'))
  .map((file) => path.basename(file, '.svg'))
  .filter((code) => !unlistedSvgs.includes(code))

const compileSass = () => sass.compile(path.join(root, 'sass/flag-icons.scss'), { style: 'expanded' }).css

const compileSassString = (source) => sass.compileString(source, { loadPaths: [root], style: 'expanded' }).css

const compileLess = async (extra = '') => {
  const file = path.join(root, 'less/flag-icons.less')
  const result = await less.render(fs.readFileSync(file, 'utf8') + extra, { filename: file })
  return result.css
}

const flagCodes = (css) => [...css.matchAll(/\.flag-icon\.flag-icon-([\w-]+)\s*\{/g)].map((m) => m[1]).filter((c) => c !== 'square')
const urls = (css) => [...css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((m) => m[1])

const outputs = {
  sass: () => compileSass(),
  less: () => compileLess(),
}

for (const [name, compile] of Object.entries(outputs)) {
  test(`${name}: defines the base .flag-icon class without element restriction`, async () => {
    const css = await compile()
    assert.match(css, /^\.flag-icon\s*\{/m)
    assert.doesNotMatch(css, /span\.flag-icon/)
    assert.match(css, /width:\s*1\.4em/)
  })

  test(`${name}: has a rule for every svg in svg/`, async () => {
    const codes = new Set(flagCodes(await compile()))
    const missing = svgCodes.filter((code) => !codes.has(code))
    assert.deepEqual(missing, [])
  })

  test(`${name}: only references svg files that exist`, async () => {
    const css = await compile()
    const broken = urls(css).filter((url) => !fs.existsSync(path.join(root, 'css', url)))
    assert.deepEqual(broken, [])
  })

  test(`${name}: leaves no uncompiled preprocessor syntax`, async () => {
    const css = await compile()
    assert.doesNotMatch(css, /#\{|@\{|\$flag-icons|@flag-icons/)
  })
}

test('sass and less generate the same flag classes', async () => {
  assert.deepEqual(flagCodes(await compileSass()), flagCodes(await compileLess()))
})

test('sass: $flag-icons-path can be configured with @use ... with', () => {
  const css = compileSassString('@use "sass/flag-icons" with ($flag-icons-path: "/assets/flags");')
  assert.ok(urls(css).every((url) => url.startsWith('/assets/flags/')))
  assert.ok(urls(css).includes('/assets/flags/missing.svg'))
})

test('less: @flag-icons-path can be overridden', async () => {
  const css = await compileLess('@flag-icons-path: "/assets/flags";')
  assert.ok(urls(css).every((url) => url.startsWith('/assets/flags/')))
  assert.ok(urls(css).includes('/assets/flags/missing.svg'))
})

test('sass: compiles without deprecation warnings', () => {
  const warnings = []
  sass.compile(path.join(root, 'sass/flag-icons.scss'), {
    logger: { warn: (message) => warnings.push(message) },
  })
  assert.deepEqual(warnings, [])
})

test('sass and less both define the square modifier', async () => {
  for (const css of [compileSass(), await compileLess()]) {
    assert.match(css, /\.flag-icon\.flag-icon-square\s*\{/)
  }
})
