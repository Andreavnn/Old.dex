import { readJson, writeJson } from './storage'
import type { SavedArmyList } from './savedLists'

export type GameStatus = 'open' | 'complete'
export type GameSide = 'player' | 'opponent'

export type GameWorkflowStep = { id: string; label: string; description: string }
export type GameWorkflowPhase = { id: string; label: string; steps: GameWorkflowStep[] }

export const gameWorkflow: GameWorkflowPhase[] = [
  { id: 'setup', label: 'Setup', steps: [
    { id: 'armies-battle', label: 'Armies & Battle', description: 'Confirm the participating army lists, battle format and selected scenario.' },
    { id: 'spells', label: 'Spells', description: 'Confirm each Wizard or Priest lore and the spells or prayers that will be used before deployment.' },
  ] },
  { id: 'overview', label: 'Overview', steps: [
    { id: 'battle-overview', label: 'Battle Overview', description: 'Review the current battle state, score, active effects and saved round history.' },
  ] },
  { id: 'deployment', label: 'Deployment', steps: [
    { id: 'deployment-order', label: 'Deployment Order', description: 'Record which player starts alternating deployment.' },
    { id: 'deploy-armies', label: 'Deploy Armies', description: 'Deploy units, record reserves and note joined characters.' },
    { id: 'first-turn', label: 'First Turn', description: 'Resolve and record the first-turn roll after deployment is complete.' },
  ] },
  { id: 'strategy', label: 'Strategy', steps: [
    { id: 'start-of-turn', label: 'Start of Turn', description: 'Resolve mandatory Start of Turn actions and active Magical Vortex movement.' },
    { id: 'command', label: 'Command', description: 'Resolve Command sub-phase abilities and usable magical items.' },
    { id: 'conjuration', label: 'Conjuration', description: 'Resolve eligible Enchantment and Hex spells.' },
    { id: 'rally', label: 'Rally Fleeing Troops', description: 'Resolve required Rally tests for fleeing friendly units.' },
  ] },
  { id: 'movement', label: 'Movement', steps: [
    { id: 'required-charges', label: 'Required Charge Tests', description: 'Resolve compulsory charge checks such as Impetuous before declaring charges.' },
    { id: 'declare-charges', label: 'Declare Charges', description: 'Declare eligible charges and record required charge declarations.' },
    { id: 'charge-moves', label: 'Charge Moves', description: 'Resolve declared charges and record successful or failed charge movement.' },
    { id: 'compulsory-moves', label: 'Compulsory Moves', description: 'Resolve fleeing movement, reserves and other compulsory movement.' },
    { id: 'remaining-moves', label: 'Remaining Moves', description: 'Resolve normal movement, marching and eligible Conveyance spells.' },
  ] },
  { id: 'shooting', label: 'Shooting', steps: [
    { id: 'special-shooting', label: 'Special Shooting Actions', description: 'Resolve Shooting-phase spells and other special actions.' },
    { id: 'shooting', label: 'Shooting', description: 'Resolve eligible missile attacks using the current weapon and profile information.' },
  ] },
  { id: 'combat', label: 'Combat', steps: [
    { id: 'fight', label: 'Choose & Fight Combat', description: 'Resolve attacking and being attacked in Initiative order.' },
    { id: 'combat-result', label: 'Calculate Combat Result', description: 'Record Combat Result and determine the winning side.' },
    { id: 'break-test', label: 'Break Test', description: 'Resolve any required Break Test and record the outcome.' },
    { id: 'follow-up', label: 'Follow Up & Pursuit', description: 'Resolve follow up, pursuit, restraint and fleeing movement.' },
  ] },
  { id: 'end', label: 'End', steps: [
    { id: 'end-turn', label: 'End of Turn', description: 'Record scoring and persistent effects, then advance to the next side or round.' },
  ] },
]

export type SavedGame = {
  id: string
  status: GameStatus
  name: string
  playerListId: string
  playerListName: string
  playerArmyName: string
  opponentListId?: string
  opponentListName?: string
  opponentArmyName?: string
  opponentName: string
  points: number
  scenario: string
  firstPlayer: GameSide
  firstPlayerConfirmed: boolean
  round: number
  activeSide: GameSide
  phaseIndex: number
  stepIndex: number
  stepNotes: Record<string, string>
  playerScore: number
  opponentScore: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

const KEY = 'olddex.games.v1'

function parseGames(value: unknown): SavedGame[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is SavedGame => Boolean(row && typeof row === 'object' && typeof (row as SavedGame).id === 'string')).map((row) => ({
    ...row,
    status: row.status === 'complete' ? 'complete' : 'open',
    round: Math.max(1, Number(row.round || 1)),
    phaseIndex: Math.max(0, Math.min(gameWorkflow.length - 1, Number(row.phaseIndex || 0))),
    stepIndex: Math.max(0, Number(row.stepIndex || 0)),
    stepNotes: { ...(row.stepNotes || {}) },
    playerScore: Math.max(0, Number(row.playerScore || 0)),
    opponentScore: Math.max(0, Number(row.opponentScore || 0)),
    firstPlayerConfirmed: typeof row.firstPlayerConfirmed === 'boolean' ? row.firstPlayerConfirmed : true,
  }))
}

function readAll() { return readJson(KEY, parseGames, []) }
function writeAll(rows: SavedGame[]) { return writeJson(KEY, rows) }

export function getSavedGames() {
  return readAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getSavedGame(id: string) { return getSavedGames().find((game) => game.id === id) || null }

export function createSavedGame(input: {
  playerList: SavedArmyList
  opponentList?: SavedArmyList | null
  opponentName?: string
  scenario: string
}) {
  const now = new Date().toISOString()
  const opponentName = input.opponentList?.name || input.opponentName?.trim() || 'Opponent'
  const game: SavedGame = {
    id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'open',
    name: `${input.playerList.name} vs ${opponentName}`,
    playerListId: input.playerList.id,
    playerListName: input.playerList.name,
    playerArmyName: input.playerList.armyName,
    opponentListId: input.opponentList?.id,
    opponentListName: input.opponentList?.name,
    opponentArmyName: input.opponentList?.armyName,
    opponentName,
    points: Math.max(input.playerList.points, input.opponentList?.points || 0),
    scenario: input.scenario || 'Open Battle',
    firstPlayer: 'player',
    firstPlayerConfirmed: false,
    round: 1,
    activeSide: 'player',
    phaseIndex: 0,
    stepIndex: 0,
    stepNotes: {},
    playerScore: 0,
    opponentScore: 0,
    createdAt: now,
    updatedAt: now,
  }
  writeAll([game, ...readAll()])
  return game
}

export function updateSavedGame(id: string, patch: Partial<Omit<SavedGame, 'id' | 'createdAt'>>) {
  const rows = readAll()
  const game = rows.find((row) => row.id === id)
  if (!game) return null
  Object.assign(game, patch, { updatedAt: new Date().toISOString() })
  writeAll(rows)
  return game
}

export function completeSavedGame(id: string) {
  return updateSavedGame(id, { status: 'complete', completedAt: new Date().toISOString() })
}
