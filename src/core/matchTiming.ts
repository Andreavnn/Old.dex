export type MatchActionStep =
  | 'setup'
  | 'deployment-order'
  | 'deploy-armies'
  | 'first-turn'
  | 'round-start'
  | 'start-of-turn'
  | 'command'
  | 'conjuration'
  | 'rally'
  | 'required-charges'
  | 'declare-charges'
  | 'charge-moves'
  | 'compulsory-moves'
  | 'remaining-moves'
  | 'special-shooting'
  | 'shooting'
  | 'fight'
  | 'combat-result'
  | 'break-test'
  | 'follow-up'
  | 'end-effects'
  | 'round-score'

export type MatchRuleIntent =
  | 'reminder'
  | 'restriction'
  | 'reaction'
  | 'deployment'
  | 'reserve'
  | 'required-charge-test'
  | 'required-charge-modifier'
  | 'charge-modifier'
  | 'spell'
  | 'expiry'

export type MatchTurnAffinity = 'own' | 'enemy' | 'either'

export type MatchTimingEvent = {
  step: MatchActionStep
  intent: MatchRuleIntent
  text: string
  confidence: number
  turn: MatchTurnAffinity
}

const fineStepPatterns: Array<[MatchActionStep, RegExp]> = [
  ['round-start', /\b(?:at|during)\s+(?:the\s+)?(?:very\s+)?(?:start|beginning) of (?:each|every|the|a) round\b|\b(?:start|beginning) of (?:each|every|the|a) round\b/i],
  ['start-of-turn', /\b(?:at|during)\s+(?:the\s+)?(?:start|beginning) of (?:your|its|their|the|each|every|a) turn\b|\b(?:start|beginning) of (?:your|its|their|the|each|every|a) turn\b/i],
  ['command', /\bcommand sub-?phase\b/i],
  ['conjuration', /\bconjuration sub-?phase\b/i],
  ['rally', /\brally(?:ing fleeing (?:troops|units))? sub-?phase\b/i],
  ['required-charges', /\brequired charge tests?\b/i],
  ['declare-charges', /\bdeclare charges?(?:\s*&\s*charge reactions?)? sub-?phase\b|\bdeclare charges?\s*(?:and|&)\s*charge reactions? sub-?phase\b/i],
  ['charge-moves', /\bcharge moves? sub-?phase\b/i],
  ['compulsory-moves', /\bcompulsory moves? sub-?phase\b/i],
  ['remaining-moves', /\bremaining moves? sub-?phase\b/i],
  ['special-shooting', /\bspecial shooting actions?\b/i],
  ['fight', /\bchoose (?:combat\s*&\s*fight|combat and fight|& fight combat|and fight combat)\b|\bchoose combat\s*&\s*fight sub-?phase\b/i],
  ['combat-result', /\bcalculate combat result\b|\bcombat result (?:step|sub-?phase)\b/i],
  ['break-test', /\bbreak tests? (?:step|sub-?phase)\b/i],
  ['follow-up', /\bfollow up\s*(?:&|and)\s*pursuit\b/i],
  ['end-effects', /\b(?:at|during)\s+(?:the\s+)?end of (?:the\s+)?round\b|\bend of round effects?\b/i],
]

const genericPhasePatterns: Array<[string, RegExp]> = [
  ['strategy', /\bstrategy phase\b/i],
  ['movement', /\bmovement phase\b/i],
  ['shooting', /\bshooting phase\b/i],
  ['combat', /\bcombat phase\b/i],
]

const deploymentRuleNames = /^(?:Ambushers?|Scouts?|Vanguard|Hidden|Tunnell?ers?|Underground Advance|Outflank(?:ers?)?)\b/i
const formationRuleNames = /^(?:Close Order|Open Order|Skirmishers)\b/i

function compact(value: string) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim()
}

export function splitRuleSentences(value: string) {
  return compact(value).match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(compact).filter(Boolean) || []
}

function turnAffinity(text: string): MatchTurnAffinity {
  const source = compact(text)
  // Resolve explicit turn ownership before reaction vocabulary. Source-book
  // headings such as “Declare Charges & Charge Reactions sub-phase of its
  // turn” describe the phase name; they do not make an own-turn rule into an
  // opponent-turn reaction.
  if (/\b(?:during|in) (?:an?|the) (?:enemy|opponent(?:'s)?) turn\b|\bduring your opponent(?:'s)? turn\b/i.test(source)) return 'enemy'
  if (/\b(?:during|in) (?:your|its|their|the controlling player's) turn\b|\bof (?:your|its|their) turn\b/i.test(source)) return 'own'
  if (/\bwhen (?:this|the|a) unit is charged\b|\bwhen charged\b|\bwhen (?:an?|the) enemy (?:unit )?declares? a charge\b|\bas (?:a )?charge reaction\b|\bmay (?:declare|make|choose) (?:a )?[^.]{0,60}charge reaction\b/i.test(source)) return 'enemy'
  return 'either'
}

function requiredChargeProvider(label: string, text: string) {
  const source = `${label} ${text}`
  if (/^\s*Impetuous(?:\s|\(|$)/i.test(label)) return true
  if (/\bgains? (?:the )?Impetuous special rule\b/i.test(source)) return true
  if (/\bmust make (?:a )?(?:Leadership|Ld) test\b[^.]{0,240}\bif (?:this|the) test is failed\b[^.]{0,140}\bmust declare a charge\b/i.test(source)) return true
  if (/\btest(?:ing)?\b[^.]{0,220}\bif (?:this|the) test is failed\b[^.]{0,140}\bmust declare a charge\b/i.test(source)) return true
  return false
}

function requiredChargeModifier(text: string) {
  return /\b(?:re-?roll|modifier|modified|unmodified|penalty|bonus)\b[^.]{0,220}\b(?:Impetuous|must declare a charge|declare a charge or act as normal|testing to (?:see|determine) if it must declare)\b/i.test(text)
    || /\b(?:Impetuous|testing to (?:see|determine) if it must declare)\b[^.]{0,220}\b(?:re-?roll|modifier|modified|unmodified|penalty|bonus)\b/i.test(text)
}

function chargeModifier(text: string) {
  return /\bmaximum possible charge range\b|\bcharge range\b[^.]{0,100}\b(?:increase|increased|bonus|modifier|add)\b|\b(?:re-?roll|modifier|bonus|add(?:s|ed|ing)?)\b[^.]{0,100}\bcharge roll\b|\bcharge roll\b[^.]{0,100}\b(?:re-?roll|modifier|bonus|increase|increased|add(?:s|ed|ing)?)\b/i.test(text)
}

function semanticStep(text: string): MatchActionStep | '' {
  if (/\bmust make (?:a )?(?:Leadership|Ld) test\b[^.]{0,240}\bmust declare a charge\b|\btesting to (?:see|determine) if (?:it|the unit) must declare a charge\b|\bImpetuous test\b/i.test(text)) return 'required-charges'
  if (/\b(?:charge roll|maximum possible charge range|failed charge|charge move)\b/i.test(text)) return 'charge-moves'
  if (/\b(?:charge reaction|declare a charge|declares? a charge)\b/i.test(text)) return 'declare-charges'
  if (/\b(?:rally test|rallying fleeing|rally a fleeing)\b/i.test(text)) return 'rally'
  if (/\b(?:Enchantment|Hex)\b/i.test(text)) return 'conjuration'
  if (/\bConveyance\b/i.test(text)) return 'remaining-moves'
  if (/\b(?:Magic Missile|Magical Vortex)\b/i.test(text)) return 'special-shooting'
  if (/\bAssailment\b/i.test(text)) return 'fight'
  if (/\b(?:combat result|combat resolution)\b/i.test(text)) return 'combat-result'
  if (/\bbreak tests?\b/i.test(text)) return 'break-test'
  if (/\b(?:pursu(?:e|it|ing)|follow up|overrun|restrain(?:t|ing)?)\b/i.test(text)) return 'follow-up'
  if (/\b(?:Random Movement|compulsory move|fleeing move|reinforcement|arrives? from reserve)\b/i.test(text)) return 'compulsory-moves'
  // Mere narrative use of words such as "march" must not create a Remaining
  // Moves task. Require an actual movement instruction, modifier or named move.
  if (/\bReserve Move\b|\bremaining moves?\b|\bnormal moves?\b|\bmovement (?:allowance|characteristic)\b/i.test(text)
    || /\b(?:may|can|must|cannot|may not|is able to|is unable to)\b[^.]{0,120}\b(?:move|march|marching)\b/i.test(text)
    || /\b(?:increase|decrease|add|subtract|double|halve|re-?roll|modifier|bonus|penalty)\b[^.]{0,120}\b(?:movement|move|march)\b/i.test(text)) return 'remaining-moves'
  if (/\b(?:shooting attack|missile weapon|to hit roll when shooting|fires? a missile)\b/i.test(text)
    || /\b(?:may|can|must|cannot|may not)\b[^.]{0,120}\b(?:shoot|fire|make a shooting attack)\b/i.test(text)) return 'shooting'
  if (/\b(?:in initiative order|when this combat is chosen|when a combat is chosen|close combat attack)\b/i.test(text)
    || /\b(?:may|can|must|cannot|may not)\b[^.]{0,120}\b(?:attack|make attacks?|fight)\b/i.test(text)) return 'fight'
  return ''
}

function genericPhaseStep(phase: string, semantic: MatchActionStep | '', text: string): MatchActionStep | '' {
  // A broad phase mention is not enough to create a match task. Old.dex's UI
  // splits several book phases into an operational order of work, so a rule is
  // placed only when its mechanic tells us which operation it belongs to.
  // This is deliberately fail-closed: passive duration text such as "until the
  // Shooting phase" must not become a new Shooting task merely because it names
  // that phase.
  if (phase === 'strategy') {
    if (semantic && ['command', 'conjuration', 'rally', 'start-of-turn'].includes(semantic)) return semantic
    if (/\b(?:at|during) (?:the )?(?:start|beginning) of (?:the )?strategy phase\b/i.test(text)) return 'start-of-turn'
    if (/\b(?:may|can|must)\s+(?:use|nominate|choose|select|attempt|make)\b|\bmake (?:a )?(?:Leadership|Ld) test\b/i.test(text)) return 'command'
    return ''
  }
  if (phase === 'movement') {
    if (semantic && ['required-charges', 'declare-charges', 'charge-moves', 'compulsory-moves', 'remaining-moves'].includes(semantic)) return semantic
    if (/\b(?:at|during) (?:the )?(?:start|beginning) of (?:the )?movement phase\b/i.test(text)) return 'required-charges'
    if (/\bReserve Move\b|\bmovement (?:allowance|characteristic)\b/i.test(text)
      || /\b(?:may|can|must|cannot|may not|is able to|is unable to)\b[^.]{0,120}\b(?:move|march|marching)\b/i.test(text)
      || /\b(?:increase|decrease|add|subtract|double|halve|modifier|bonus|penalty)\b[^.]{0,120}\b(?:movement|move|march)\b/i.test(text)) return 'remaining-moves'
    return ''
  }
  if (phase === 'shooting') {
    if (semantic && ['special-shooting', 'shooting'].includes(semantic)) return semantic
    if (/\b(?:at|during) (?:the )?(?:start|beginning) of (?:the )?shooting phase\b/i.test(text)) return 'special-shooting'
    if (/\b(?:shooting attack|missile weapon|ranged attack|to hit roll|to wound roll)\b/i.test(text)
      || /\b(?:may|can|must|cannot|may not)\b[^.]{0,120}\b(?:shoot|fire|make a shooting attack)\b/i.test(text)) return 'shooting'
    return ''
  }
  if (phase === 'combat') {
    if (semantic && ['fight', 'combat-result', 'break-test', 'follow-up'].includes(semantic)) return semantic
    if (/\b(?:at|during) (?:the )?(?:start|beginning) of (?:the )?combat phase\b/i.test(text)) return 'fight'
    if (/\b(?:to hit roll|to wound roll|initiative order|close combat attack)\b/i.test(text)
      || /\b(?:may|can|must|cannot|may not)\b[^.]{0,120}\b(?:attack|make attacks?|fight)\b/i.test(text)) return 'fight'
    return ''
  }
  return semantic
}

function explicitFineStep(text: string) {
  for (const [step, pattern] of fineStepPatterns) if (pattern.test(text)) return step
  return '' as MatchActionStep | ''
}

function explicitGenericPhase(text: string) {
  for (const [phase, pattern] of genericPhasePatterns) if (pattern.test(text)) return phase
  return ''
}

function intentFor(step: MatchActionStep, label: string, text: string): MatchRuleIntent {
  if (requiredChargeProvider(label, text)) return 'required-charge-test'
  if (step === 'required-charges' && requiredChargeModifier(text)) return 'required-charge-modifier'
  if (step === 'charge-moves' && chargeModifier(text)) return 'charge-modifier'
  if (step === 'deploy-armies') {
    if (/\b(?:held|placed|kept|start(?:s|ing)?) (?:the battle )?in reserve\b|\bAmbushers?\b/i.test(`${label} ${text}`)) return 'reserve'
    return 'deployment'
  }
  if (/\bcharge reaction\b|\bwhen (?:this|the|a) unit is charged\b|\bwhen charged\b/i.test(text)) return 'reaction'
  if (/\b(?:cannot|may not|must not|is unable to|does not)\b/i.test(text)) return 'restriction'
  if (/\b(?:expires?|ceases?|until the start|until the end)\b/i.test(text)) return 'expiry'
  return 'reminder'
}

function dependentContinuation(sentence: string, hasPrior: boolean) {
  if (!hasPrior) return false
  return /^(?:If|Should)\s+(?:this|that|the nominated|the affected|it|they)\b/i.test(sentence)
    || /^If\s+(?:passed|successful|the test is passed|this test is passed|the test is successful|this test is successful)\b/i.test(sentence)
    || /^(?:The nominated|The affected)\b/i.test(sentence)
    || /\bthis test\b/i.test(sentence) && /\bagain\b|\bas normal\b/i.test(sentence)
}

function eventFromSentence(label: string, sentence: string): MatchTimingEvent | null {
  const source = compact(sentence)
  if (!source) return null
  // Duration/expiry references tell us how long another effect lasts; they do
  // not create a new action in the phase they happen to name.
  if (/\b(?:lasts?|remains?|continues?|persists?|applies?)\b[^.]{0,160}\buntil\b[^.]{0,120}\b(?:strategy|movement|shooting|combat) phase\b/i.test(source)
    || /\buntil (?:the )?(?:start|beginning|end)?\s*(?:of )?(?:the )?(?:strategy|movement|shooting|combat) phase\b/i.test(source)) return null
  const semantic = semanticStep(source)
  let fine = explicitFineStep(source)

  // Old.dex intentionally separates Required Charge Tests from the source-book
  // "Declare Charges & Charge Reactions" sequence. A rule whose operation is a
  // test that decides whether a charge becomes compulsory belongs in RCT even
  // when its source timing names the combined book sub-phase.
  const provider = requiredChargeProvider(label, source)
  const rctModifier = requiredChargeModifier(source)
  if (provider) fine = 'required-charges'
  else if (rctModifier && (!fine || fine === 'declare-charges')) fine = 'required-charges'

  if (fine) {
    // A fine-grained named slot wins over words describing the effect. Rallying
    // Cry is the canonical example: Command is its activation point even though
    // the effect immediately causes a Rally test.
    return { step: fine, intent: intentFor(fine, label, source), text: source, confidence: provider ? 110 : 100, turn: turnAffinity(source) }
  }

  const phase = explicitGenericPhase(source)
  if (phase) {
    const step = genericPhaseStep(phase, semantic, source)
    if (!step) return null
    return { step, intent: intentFor(step, label, source), text: source, confidence: 85, turn: turnAffinity(source) }
  }

  if (deploymentRuleNames.test(label) || /\b(?:before either side deploys|before deployment|during deployment|when deployed|after both sides have deployed|held in reserve|placed in reserve|deployment zone)\b/i.test(source)) {
    const step: MatchActionStep = 'deploy-armies'
    return { step, intent: intentFor(step, label, source), text: source, confidence: 90, turn: 'either' }
  }

  if (/\b(?:before the battle begins|before deployment begins|before the battle)\b/i.test(source)) {
    return { step: 'setup', intent: 'reminder', text: source, confidence: 90, turn: 'either' }
  }

  if (/\b(?:determine|roll for|chooses?)\b[^.]{0,100}\bfirst turn\b|\bfirst turn\b[^.]{0,100}\broll off\b/i.test(source)) {
    return { step: 'first-turn', intent: 'reminder', text: source, confidence: 90, turn: 'either' }
  }

  if (semantic) return { step: semantic, intent: intentFor(semantic, label, source), text: source, confidence: 70, turn: turnAffinity(source) }
  return null
}

function mergeEvents(events: MatchTimingEvent[]) {
  const grouped = new Map<string, MatchTimingEvent>()
  for (const event of events) {
    const key = `${event.step}|${event.intent}|${event.turn}`
    const prior = grouped.get(key)
    if (!prior) { grouped.set(key, { ...event }); continue }
    if (!prior.text.toLowerCase().includes(event.text.toLowerCase())) prior.text = `${prior.text} ${event.text}`.trim()
    prior.confidence = Math.max(prior.confidence, event.confidence)
  }
  return [...grouped.values()]
}

export function analyzeMatchRuleTiming(label: string, text: string): MatchTimingEvent[] {
  const cleanLabel = compact(label)
  const fullText = compact(text)

  // Canonical reactive rules are anchored to the opponent's action window.
  // This prevents later sentences describing the reaction's movement from
  // being misinterpreted as a friendly Remaining Moves task.
  if (/^Counter Charge(?:\s|\(|$)/i.test(cleanLabel)) {
    return [{ step: 'declare-charges', intent: 'reaction', text: fullText || cleanLabel, confidence: 125, turn: 'enemy' }]
  }

  const sentences = splitRuleSentences(text)
  const events: MatchTimingEvent[] = []
  let lastEvent: MatchTimingEvent | null = null

  for (const sentence of sentences.length ? sentences : [compact(text)]) {
    if (!sentence) continue
    if (dependentContinuation(sentence, Boolean(lastEvent)) && lastEvent) {
      lastEvent.text = `${lastEvent.text} ${sentence}`.trim()
      continue
    }

    const event = eventFromSentence(cleanLabel, sentence)
    if (event) {
      events.push(event)
      lastEvent = event
    } else if (lastEvent && /^(?:In this way|This|These|It|They|However|Otherwise)\b/i.test(sentence)) {
      lastEvent.text = `${lastEvent.text} ${sentence}`.trim()
    }

    // One sentence can contain two genuinely different operational effects. Do
    // not make broad phase words duplicate a rule, but do preserve independent
    // mechanics such as "charge range / Charge roll" plus "gains Impetuous".
    if (!explicitFineStep(sentence)) {
      if (requiredChargeProvider(cleanLabel, sentence) && event?.step !== 'required-charges') {
        events.push({ step: 'required-charges', intent: 'required-charge-test', text: sentence, confidence: 105, turn: turnAffinity(sentence) })
      } else if (requiredChargeModifier(sentence) && event?.step !== 'required-charges') {
        events.push({ step: 'required-charges', intent: 'required-charge-modifier', text: sentence, confidence: 75, turn: turnAffinity(sentence) })
      }
      if (chargeModifier(sentence) && event?.step !== 'charge-moves') {
        events.push({ step: 'charge-moves', intent: 'charge-modifier', text: sentence, confidence: 75, turn: turnAffinity(sentence) })
      }
    }
  }

  // A source can expose a rule name but truncate its body. Preserve only highly
  // canonical operational names rather than guessing from generic labels.
  if (!events.length) {
    if (/^Impetuous(?:\s|\(|$)/i.test(cleanLabel)) events.push({ step: 'required-charges', intent: 'required-charge-test', text: cleanLabel, confidence: 100, turn: 'own' })
    else if (deploymentRuleNames.test(cleanLabel)) events.push({ step: 'deploy-armies', intent: /Ambushers?/i.test(cleanLabel) ? 'reserve' : 'deployment', text: cleanLabel, confidence: 80, turn: 'either' })
  }

  return mergeEvents(events)
}

export function isRequiredChargeProvider(label: string, text: string) {
  return analyzeMatchRuleTiming(label, text).some((event) => event.step === 'required-charges' && event.intent === 'required-charge-test')
}

export function isFormationRuleName(label: string) { return formationRuleNames.test(compact(label)) }
