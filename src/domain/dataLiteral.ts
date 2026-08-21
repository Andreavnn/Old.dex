/**
 * Parses the data-only JavaScript object/array literals published by Old World
 * Builder without executing remote source code. The supported grammar covers
 * JSON plus the small conveniences used in OWB data modules: quoted or bare
 * object keys, single/double/backtick strings (without interpolation), trailing
 * commas, line/block comments, and the primitive identifiers true/false/null.
 */
export function parseDataLiteral(source: string): unknown {
  let index = 0

  const error = (message: string): never => {
    const start = Math.max(0, index - 24)
    const end = Math.min(source.length, index + 24)
    throw new Error(`${message} near '${source.slice(start, end).replace(/\s+/g, ' ')}'.`)
  }

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
        const end = source.indexOf('*/', index)
        if (end < 0) error('Unterminated block comment')
        index = end + 2
        continue
      }
      break
    }
  }

  const parseString = () => {
    const quote = source[index++]
    let value = ''
    while (index < source.length) {
      const char = source[index++]
      if (char === quote) return value
      if (char === '\\') {
        if (index >= source.length) error('Unterminated string escape')
        const escaped = source[index++]
        const simple: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0', '\\': '\\', "'": "'", '"': '"', '`': '`' }
        if (escaped in simple) { value += simple[escaped]; continue }
        if (escaped === 'x') {
          const hex = source.slice(index, index + 2)
          if (!/^[0-9a-f]{2}$/i.test(hex)) error('Invalid hexadecimal string escape')
          value += String.fromCharCode(Number.parseInt(hex, 16)); index += 2; continue
        }
        if (escaped === 'u') {
          if (source[index] === '{') {
            const close = source.indexOf('}', index + 1)
            if (close < 0) error('Invalid Unicode string escape')
            const hex = source.slice(index + 1, close)
            if (!/^[0-9a-f]{1,6}$/i.test(hex)) error('Invalid Unicode code point')
            value += String.fromCodePoint(Number.parseInt(hex, 16)); index = close + 1; continue
          }
          const hex = source.slice(index, index + 4)
          if (!/^[0-9a-f]{4}$/i.test(hex)) error('Invalid Unicode string escape')
          value += String.fromCharCode(Number.parseInt(hex, 16)); index += 4; continue
        }
        // JavaScript permits escaping otherwise ordinary characters. Preserve
        // the character rather than evaluating anything.
        value += escaped
        continue
      }
      if (quote === '`' && char === '$' && source[index] === '{') error('Template interpolation is not allowed in data literals')
      value += char
    }
    return error('Unterminated string')
  }

  const parseIdentifier = () => {
    const start = index
    if (!/[A-Za-z_$]/.test(source[index] || '')) error('Expected identifier')
    index += 1
    while (/[A-Za-z0-9_$-]/.test(source[index] || '')) index += 1
    return source.slice(start, index)
  }

  const parseNumber = () => {
    const match = source.slice(index).match(/^[+-]?(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/)
    if (!match) error('Invalid number')
    index += match[0].length
    const raw = match[0]
    const value = /^[-+]?0[xX]/.test(raw) ? Number.parseInt(raw, 16) : /^[-+]?0[bB]/.test(raw) ? Number.parseInt(raw.replace(/^[+-]?0[bB]/, ''), 2) : /^[-+]?0[oO]/.test(raw) ? Number.parseInt(raw.replace(/^[+-]?0[oO]/, ''), 8) : Number(raw)
    if (!Number.isFinite(value)) error('Non-finite number is not allowed')
    return value
  }

  const parseArray = (): unknown[] => {
    index += 1
    const rows: unknown[] = []
    skip()
    if (source[index] === ']') { index += 1; return rows }
    while (index < source.length) {
      rows.push(parseValue())
      skip()
      if (source[index] === ']') { index += 1; return rows }
      if (source[index] !== ',') error("Expected ',' or ']' in array")
      index += 1
      skip()
      if (source[index] === ']') { index += 1; return rows }
    }
    return error('Unterminated array')
  }

  const parseObject = (): Record<string, unknown> => {
    index += 1
    const row: Record<string, unknown> = {}
    skip()
    if (source[index] === '}') { index += 1; return row }
    while (index < source.length) {
      skip()
      const key = source[index] === '"' || source[index] === "'" || source[index] === '`' ? parseString() : parseIdentifier()
      skip()
      if (source[index] !== ':') error("Expected ':' after object key")
      index += 1
      row[key] = parseValue()
      skip()
      if (source[index] === '}') { index += 1; return row }
      if (source[index] !== ',') error("Expected ',' or '}' in object")
      index += 1
      skip()
      if (source[index] === '}') { index += 1; return row }
    }
    return error('Unterminated object')
  }

  const parseValue = (): unknown => {
    skip()
    const char = source[index]
    if (char === '{') return parseObject()
    if (char === '[') return parseArray()
    if (char === '"' || char === "'" || char === '`') return parseString()
    if (/[+\-.0-9]/.test(char || '')) return parseNumber()
    if (/[A-Za-z_$]/.test(char || '')) {
      const identifier = parseIdentifier()
      if (identifier === 'true') return true
      if (identifier === 'false') return false
      if (identifier === 'null') return null
      if (identifier === 'undefined') return undefined
      error(`Unsupported identifier '${identifier}'`)
    }
    return error('Expected data value')
  }

  const result = parseValue()
  skip()
  if (index !== source.length) error('Unexpected trailing content')
  return result
}
