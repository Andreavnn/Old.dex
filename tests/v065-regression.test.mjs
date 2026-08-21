import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'

const unit = readFileSync('src/views/UnitView.vue', 'utf8')
const match = readFileSync('src/views/GameMatchView.vue', 'utf8')
const setup = readFileSync('src/services/gameSetup.ts', 'utf8')
const games = readFileSync('src/services/games.ts', 'utf8')
const styles = readFileSync('src/styles.css', 'utf8')

test('v0.65 non-editable Old.dex UI suppresses stray text carets while real inputs retain them', () => {
  assert.match(styles, /html,body,#app,\.app-shell\{caret-color:transparent\}/)
  assert.match(styles, /input,textarea,\[contenteditable="true"\]\{caret-color:auto\}/)
  assert.match(styles, /button,\[role="button"\],label,summary[\s\S]*user-select:none/)
  assert.doesNotMatch(unit, /class="magic-picker-item-main" @click=/)
  assert.match(unit, /class="magic-picker-expand"/)
  assert.match(unit, /class="magic-picker-item-copy"/)
})

test('v0.65 turn context is available throughout battle phases and filters phase guidance', () => {
  assert.match(match, /battleTurnPhaseIds = new Set\(\['strategy', 'movement', 'shooting', 'combat', 'end'\]\)/)
  assert.match(match, /TURN VIEW/)
  assert.match(match, />Your Turn<\/button>/)
  assert.match(match, />Enemy's Turn<\/button>/)
  assert.match(match, /loadTurnStepGuidance/)
  assert.match(match, /const turnViewSide = ref<GameSide>/)
  assert.match(match, /turnViewSide\.value = side/)
  const viewSetter = match.slice(match.indexOf('function selectTurnContext'), match.indexOf('function startTurnFromEnd'))
  assert.doesNotMatch(viewSetter, /persist\(\{ activeSide:/)
  assert.match(setup, /turnStepPatterns/)
  assert.match(setup, /enemyTurnCue/)
  assert.match(setup, /reactionCue/)
  assert.match(setup, /turnSentenceCache/)
})

test('v0.65 End of Round uses explicit turn/round routing and only End of Round increments the round tracker', () => {
  assert.match(games, /\{ id: 'end', label: 'End of Round'/)
  assert.match(match, /function startTurnFromEnd\(side: GameSide\)/)
  assert.match(match, /function endRoundFromEnd\(\)/)
  assert.match(match, /roundsCompleted: completed/)
  assert.match(match, />Back<\/button><button[^>]*>Your Turn<\/button><button[^>]*>Enemy's Turn<\/button><button[^>]*>End of Round<\/button>/s)
  const startTurn = match.slice(match.indexOf('function startTurnFromEnd'), match.indexOf('function endRoundFromEnd'))
  assert.doesNotMatch(startTurn, /roundsCompleted/)
})

test('v0.65 turn guidance remains friendly-player focused during both turn views', () => {
  assert.match(setup, /rosterTurnRules\(friendly, stepId, viewSide\)/)
  assert.match(match, /FRIENDLY ROSTER/)
  assert.match(match, /No friendly rules or reactions were detected/)
})

test('v0.65 interactive controls follow one app-wide HTML contract', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = `${dir}/${name}`
      if (statSync(path).isDirectory()) walk(path)
      else if (path.endsWith('.vue')) files.push(path)
    }
  }
  walk('src')
  for (const path of files) {
    const source = readFileSync(path, 'utf8')
    assert.doesNotMatch(source, /contenteditable\s*=\s*["']true["']/i, `${path} should not create ad-hoc editable regions`)
    for (const match of source.matchAll(/<button\b([^>]*)>/g)) assert.match(match[1], /\btype=/, `${path} button must declare a type`)
  }
})
