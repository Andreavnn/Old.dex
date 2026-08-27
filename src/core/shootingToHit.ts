export type ShootingToHitResult = {
  ballisticSkill: number
  modifier: number
  target: number
  label: string
  detail?: string
}

export function shootingToHit(ballisticSkill: number, modifier = 0): ShootingToHitResult {
  const bs = Math.max(0, Math.floor(Number(ballisticSkill) || 0))
  const mod = Math.trunc(Number(modifier) || 0)
  if (!bs) return { ballisticSkill: 0, modifier: mod, target: 0, label: '—' }

  // The Old World shooting table is BS1=6+, BS2=5+, BS3=4+, BS4=3+, BS5+=2+.
  // Negative modifiers raise the target number. Natural 1 always fails.
  const baseTarget = Math.max(2, 7 - Math.min(bs, 5))
  const target = Math.max(2, baseTarget - mod)
  if (target >= 10) return { ballisticSkill: bs, modifier: mod, target, label: 'Impossible', detail: '10+ To Hit is impossible.' }
  if (target >= 7) {
    const followUp = target === 7 ? 4 : target === 8 ? 5 : 6
    return { ballisticSkill: bs, modifier: mod, target, label: `6 then ${followUp}+`, detail: `${target}+ To Hit: a natural 6 must be followed by ${followUp}+. ` }
  }

  if (bs >= 6) {
    const rerollTarget = Math.max(2, 12 - bs)
    return { ballisticSkill: bs, modifier: mod, target, label: `${target}+ / ${rerollTarget}+ re-roll`, detail: 'BS6+ may re-roll a failed first To Hit roll; modifiers apply only to the first roll.' }
  }
  return { ballisticSkill: bs, modifier: mod, target, label: `${target}+` }
}
