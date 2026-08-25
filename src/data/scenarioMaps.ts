export const pitchedBattleScenarioPaths: Record<string, string> = {
  'open-battle': '/warhammer-battles/open-battle',
  'meeting-engagement': '/warhammer-battles/meeting-engagement',
  'flank-attack': '/warhammer-battles/flank-attack',
  'command-and-control': '/warhammer-battles/command-and-control',
  'mountain-pass': '/warhammer-battles/mountain-pass',
  'break-point': '/warhammer-battles/break-point-warhammer-battles',
}

export const pitchedBattleScenarioMaps: Record<string, string> = {
  'open-battle': 'https://images.ctfassets.net/0v8db9sevlqj/7LggvP50VKWU3OopRTexXh/2e2d7def32691aab8244956cae65f7b9/open-battle.png?fl=progressive&fm=jpg',
  'break-point': 'https://images.ctfassets.net/0v8db9sevlqj/1QaDPpMQ6PGcxRUwA0MvtH/11bd0355e389a46615973f6d98839ad3/break-point.png?fl=progressive&fm=jpg',
  'flank-attack': 'https://images.ctfassets.net/0v8db9sevlqj/3cFNz0niHYduLBCqCiTlrm/4952cb3bf6cfcb00a5ba1fef2e31d3b9/flank-attack.png?fl=progressive&fm=jpg',
  'meeting-engagement': 'https://images.ctfassets.net/0v8db9sevlqj/7yZS62jMhWGPK5Zv18EwNa/9aecba2f4e9d5012884acd32723fad6e/meeting-engagement.png?fl=progressive&fm=jpg',
  'mountain-pass': 'https://images.ctfassets.net/0v8db9sevlqj/xwmN1DZUQfqNwWqj6aDM6/ed147f8a1b27eddb0818e8948bb68c60/mountain-pass.png?fl=progressive&fm=jpg',
  'command-and-control': 'https://images.ctfassets.net/0v8db9sevlqj/6opUfcxsYRURY4MpEjWUAy/f5e6a495c86135dc2ca15ceade552f78/command-and-control.png?fl=progressive&fm=jpg',
}

export function pitchedBattleScenarioSlugFromPath(path: string) {
  const normalized = String(path || '').replace(/\/$/, '')
  return Object.entries(pitchedBattleScenarioPaths).find(([, sourcePath]) => sourcePath === normalized)?.[0] || ''
}
