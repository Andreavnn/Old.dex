import type { ChangelogEntry } from './changelog'

export const changelogV038: ChangelogEntry = {
  version: '0.38',
  title: 'Canonical rule-content pipeline and shield save repair',
  notes: [
    'Rebuilt the shared rules transport around the same minimal rules-index request used by Old World Builder. Old.dex now requests canonical tow.whfb.app rule pages with minimal=true before any page is cleaned, parsed or displayed, preventing source-site navigation, update metadata and error chrome from leaking into rule cards.',
    'Reworked the central rule-text extractor so Rules, roster profiles, match intelligence and inline rule cards all reject source metadata, Table of Contents text, broken-page notices and navigation fragments instead of each feature maintaining a different permissive fallback.',
    'Removed broad rule-card fallback scraping that could substitute flavour or unrelated nearby paragraphs when a canonical page did not expose mechanical text. Missing mechanical content now fails closed rather than displaying misleading source text as a rule.',
    'Added a dedicated magical-item reference resolver. It reads the individual canonical item page first and, when that entry is incomplete, checks the appropriate common or army magic-item collection page and merges the richer weapon profile, Notes and linked special rules.',
    'Guaranteed Magical Attacks on selected magic-weapon references and surfaced resolved Range, Strength, AP and Special Rules directly inside expanded magical-item picker entries.',
    'Hardened magical shield detection so a selected magic shield improves the owning model armour save even if its external rule page is temporarily incomplete or unavailable.',
    'Hardened mundane shield normalization from both the source name and Old World Builder canonical shield path. A selected shield is always treated as a unit-level equipment choice and applies its +1 armour-save improvement to eligible rider/unit profiles.',
    'Bundled Old World Builder’s current rule-index export and synonym map with Old.dex, while retaining live OWB refreshes when available. Installed/offline sessions therefore keep the canonical name-to-rule resolver required for basic rule linking.',
    'Invalidated the previous rule-content cache so stale full-page/source-chrome parses cannot survive the new canonical minimal-content pipeline.',
    'Bumped the package, header, footer and PWA shell to Alpha Build 0.38.',
  ],
}
