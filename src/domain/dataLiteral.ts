/**
 * Parses the data-only subset of JavaScript object literals used by the upstream
 * Builder rules file. It deliberately rejects expressions, functions, spread,
 * template interpolation and executable identifiers.
 */
export function parseDataLiteral(source: string): unknown {
  let index = 0

  const fail = (message: string): never => { throw new Error(`${message} at offset ${index}.`) }
  const peek = () => source[index]
  const skip = () => {
    while (index < source.length) {
      if (/\s/.test(source[index])) { index += 1; continue }
      if (source[index] === '/' && source[index + 1] === '/') {
        index += 2
        while (index < source.length && source[index] !== '\n') index += 1
        continue
      }
      if (source[index] === '/' && source[index + 1] === '*') {
        index += 2
        while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1
        if (index >= source.length) fail('Unterminated comment')
        index += 2
        continue
      }
      break
    }
  }

  const parseString = () => {
    const quote = source[index++]
    if (quote === '`') fail('Template literals are not allowed')
    let out = ''
    while (index < source.length) {
      const char = source[index++]
      if (char === quote) return out
      if (char !== '\\') { out += char; continue }
      if (index >= source.length) fail('Unterminated string escape')
      const escaped = source[index++]
      const table: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' }
      if (escaped === 'u') {
        const hex = source.slice(index, index + 4)
        if (!/^[0-9a-f]{4}$/i.test(hex)) fail('Invalid unicode escape')
        out += String.fromCharCode(Number.parseInt(hex, 16)); index += 4; continue
      }
      if (escaped === 'x') {
        const hex = source.slice(index, index + 2)
        if (!/^[0-9a-f]{2}$/i.test(hex)) fail('Invalid hex escape')
        out += String.fromCharCode(Number.parseInt(hex, 16)); index += 2; continue
      }
      out += table[escaped] ?? escaped
    }
    return fail('Unterminated string')
  }

  const parseIdentifier = () => {
    const match = source.slice(index).match(/^[A-Za-z_$][\w$-]*/)
    if (!match) return fail('Expected identifier')
    index += match[0].length
    return match[0]
  }

  const parseNumber = () => {
    const match = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
    if (!match) return fail('Invalid number')
    index += match[0].length
    const value = Number(match[0])
    if (!Number.isFinite(value)) return fail('Non-finite numbers are not allowed')
    return value
  }

  const parseArray = (): unknown[] => {
    index += 1
    const rows: unknown[] = []
    skip()
    if (peek() === ']') { index += 1; return rows }
    while (index < source.length) {
      rows.push(parseValue())
      skip()
      if (peek() === ']') { index += 1; return rows }
      if (peek() !== ',') fail('Expected comma in array')
      index += 1; skip()
      if (peek() === ']') { index += 1; return rows }
    }
    return fail('Unterminated array')
  }

  const parseObject = (): Record<string, unknown> => {
    index += 1
    const row: Record<string, unknown> = {}
    skip()
    if (peek() === '}') { index += 1; return row }
    while (index < source.length) {
      skip()
      const char = peek()
      const key = char === '"' || char === "'" ? parseString() : parseIdentifier()
      skip()
      if (peek() !== ':') fail('Expected colon in object')
      index += 1
      row[key] = parseValue()
      skip()
      if (peek() === '}') { index += 1; return row }
      if (peek() !== ',') fail('Expected comma in object')
      index += 1; skip()
      if (peek() === '}') { index += 1; return row }
    }
    return fail('Unterminated object')
  }

  const parseValue = (): unknown => {
    skip()
    const char = peek()
    if (char === '{') return parseObject()
    if (char === '[') return parseArray()
    if (char === '"' || char === "'" || char === '`') return parseString()
    if (char === '-' || /\d/.test(char || '')) return parseNumber()
    const identifier = parseIdentifier()
    if (identifier === 'true') return true
    if (identifier === 'false') return false
    if (identifier === 'null') return null
    return fail(`Executable identifier '${identifier}' is not allowed`)
  }

  const result = parseValue()
  skip()
  if (index !== source.length) fail('Unexpected trailing input')
  return result
}
