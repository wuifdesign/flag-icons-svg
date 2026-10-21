import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
const write = (file, content) => fs.writeFileSync(path.join(root, file), content)

const { unlisted, countries } = JSON.parse(read('flags.json'))
const codes = Object.keys(countries).sort()

const svgCodes = fs
  .readdirSync(path.join(root, 'svg'))
  .filter((file) => file.endsWith('.svg'))
  .map((file) => path.basename(file, '.svg'))
const problems = [
  ...codes.filter((code) => !svgCodes.includes(code)).map((code) => `flags.json lists "${code}" but svg/${code}.svg does not exist`),
  ...svgCodes
    .filter((code) => !codes.includes(code) && !unlisted.includes(code))
    .map((code) => `svg/${code}.svg is neither in flags.json "countries" nor "unlisted"`),
]
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const replaceBetween = (file, start, end, body) => {
  const source = read(file)
  const from = source.indexOf(start)
  const to = source.indexOf(end, from)
  if (from === -1 || to === -1) {
    throw new Error(`${file}: markers ${start} / ${end} not found`)
  }
  write(file, source.slice(0, from + start.length) + body + source.slice(to))
}

write(
  'sass/_variables.scss',
  `@use "sass:list";

$flag-icons-path: '../svg' !default;

$flag-icons-countries: (
${codes.map((code) => `  '${code}'`).join('\n')}
);

$flag-icons-extra: ();

$flag-icons-elements: list.join($flag-icons-countries, $flag-icons-extra, comma);
`,
)

write(
  'less/_variables.less',
  `@flag-icons-path: '../svg';

@flag-icons-countries:
${codes.map((code) => `  ${code}`).join('\n')}
;

@flag-icons-elements: @flag-icons-countries;
`,
)

const row = (code, label, name) => `| <img src='svg/${code}.svg?raw=true' width='21' height='15'> | ${label} | ${name}`
replaceBetween(
  'README.md',
  '<!-- flags:start -->\n',
  '<!-- flags:end -->',
  [
    '| Flag | Code | Region |',
    '| :-------------: | :-------------: | ------------- |',
    row('missing', '--', 'Missing Flag'),
    ...codes.map((code) => row(code, code.toUpperCase(), countries[code])),
    '',
  ].join('\n'),
)

replaceBetween(
  'test.html',
  '/* flags:start */\n',
  '    /* flags:end */',
  ['missing', ...codes].map((code) => `    '${code}',\n`).join(''),
)
