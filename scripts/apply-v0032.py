#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import argparse
import re
import shutil

PATCH_VERSION = "0.032"
SCRIPT_DIR = Path(__file__).resolve().parent
PACKAGE_ROOT = SCRIPT_DIR.parent
PAYLOAD_REL = Path("payload")

DISCORD_SVG = (
    '<svg class="discord-button-icon" aria-hidden="true" viewBox="0 0 24 24" '
    'fill="currentColor"><path d="M19.54 5.34A16.3 16.3 0 0 0 15.44 4l-.5 1.03'
    'a15.3 15.3 0 0 0-5.87 0L8.56 4a16.5 16.5 0 0 0-4.1 1.35C1.86 9.2 '
    '1.15 12.96 1.5 16.67a16.6 16.6 0 0 0 5.03 2.54l1.22-1.67a10.5 '
    '10.5 0 0 1-1.92-.92l.47-.36c3.7 1.72 7.71 1.72 11.36 0l.48.36c-.6.35'
    '-1.25.66-1.93.92l1.22 1.67a16.5 16.5 0 0 0 5.03-2.54c.42-4.3-.72'
    '-8.03-2.92-11.33ZM8.65 14.42c-1.11 0-2.02-1.03-2.02-2.3 0-1.26.89'
    '-2.3 2.02-2.3 1.14 0 2.04 1.04 2.02 2.3 0 1.27-.9 2.3-2.02 '
    '2.3Zm6.7 0c-1.11 0-2.02-1.03-2.02-2.3 0-1.26.89-2.3 2.02-2.3 '
    '1.14 0 2.04 1.04 2.02 2.3 0 1.27-.88 2.3-2.02 2.3Z"/></svg>'
)

CSS_MARKER = "/* Old.dex v0.032 UI cleanup */"
CSS_BLOCK = r'''
/* Old.dex v0.032 UI cleanup */
.discord-button-icon {
  width: 1.05em;
  height: 1.05em;
  flex: 0 0 auto;
  display: inline-block;
}
a[href*="discord"], button[class*="discord"], .discord-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
}
.splash-actions:has(a[href*="discord"]),
.splash-links:has(a[href*="discord"]),
.splash-support:has(a[href*="discord"]) {
  justify-content: center;
}
.install-button img,
.install-icon img,
.pwa-install img,
.pwa-install-button img,
button[aria-label*="Install" i] img,
a[aria-label*="Install" i] img {
  width: 20px !important;
  height: 20px !important;
  max-width: 20px !important;
  max-height: 20px !important;
  object-fit: contain !important;
  padding: 2px !important;
  box-sizing: border-box !important;
}
.language-selector,
.language-options,
.footer-language,
[data-setting="language"],
[data-settings-key="language"] {
  display: none !important;
}
'''.strip() + "\n"

def die(message: str) -> None:
    raise SystemExit(f"[Old.dex v{PATCH_VERSION}] {message}")

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")

def copy_payload(repo: Path) -> list[str]:
    payload = PACKAGE_ROOT / PAYLOAD_REL
    if not payload.exists():
        die(f"Missing payload directory: {payload}")
    changed = []
    for src in payload.rglob("*"):
        if not src.is_file():
            continue
        rel = src.relative_to(payload)
        dst = repo / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        changed.append(str(rel))
    return changed

def add_import(source: str, import_line: str) -> tuple[str, bool]:
    if import_line in source:
        return source, False
    imports = list(re.finditer(r"(?m)^import .*?;\s*$", source))
    if imports:
        pos = imports[-1].end()
        return source[:pos] + "\n" + import_line + source[pos:], True
    return import_line + "\n" + source, True

def patch_profile_source(repo: Path) -> list[str]:
    path = repo / "src/data/liveBuilderUnits.ts"
    if not path.exists():
        die("Expected src/data/liveBuilderUnits.ts was not found. Refusing to guess the data integration point.")

    source = read(path)
    original = source
    import_line = "import { selectExactLegacyProfile } from '../domain/profiles/profileIdentity';"
    source, _ = add_import(source, import_line)

    replacements = 0
    patterns = [
        (
            r"(?P<lhs>\bunit\.profile\s*=\s*)rawProfiles\[0\]\.profile\s*;",
            r"\g<lhs>(selectExactLegacyProfile(unit.name, String(unit.id), rawProfiles)?.profile ?? unit.profile);",
        ),
        (
            r"(?P<lhs>\bunit\.profile\s*=\s*)profiles\[0\]\.profile\s*;",
            r"\g<lhs>(selectExactLegacyProfile(unit.name, String(unit.id), profiles)?.profile ?? unit.profile);",
        ),
    ]
    for pattern, replacement in patterns:
        source, count = re.subn(pattern, replacement, source)
        replacements += count

    source, count = re.subn(
        r"if\s*\(\s*rawProfiles\.length\s*\)\s*\{\s*unit\.profiles\s*=\s*rawProfiles\s*;\s*"
        r"unit\.profile\s*=\s*rawProfiles\[0\]\.profile\s*;\s*\}",
        "if (rawProfiles.length) { unit.profiles = rawProfiles; "
        "const exact = selectExactLegacyProfile(unit.name, String(unit.id), rawProfiles); "
        "if (exact?.profile) unit.profile = exact.profile; }",
        source,
    )
    replacements += count

    source, count = re.subn(
        r"if\s*\(\s*profiles\.length\s*\)\s*\{\s*unit\.profiles\s*=\s*profiles\s*;\s*"
        r"unit\.profile\s*=\s*profiles\[0\]\.profile\s*;\s*\}",
        "if (profiles.length) { unit.profiles = profiles; "
        "const exact = selectExactLegacyProfile(unit.name, String(unit.id), profiles); "
        "if (exact?.profile) unit.profile = exact.profile; }",
        source,
    )
    replacements += count

    unsafe = re.findall(r"\b(?:rawProfiles|profiles)\s*\[\s*0\s*\]\s*\.profile", source)
    if unsafe:
        die("liveBuilderUnits.ts still contains a direct profiles[0].profile assignment after migration.")

    if replacements == 0 and "selectExactLegacyProfile" not in original:
        die(
            "No known first-profile assignment anchor was found in liveBuilderUnits.ts. "
            "Current source differs from the reviewed lineage; refusing a silent partial rebuild."
        )

    if source != original:
        write(path, source)
        return [str(path.relative_to(repo))]
    return []

def patch_unit_view(repo: Path) -> list[str]:
    path = repo / "src/views/UnitView.vue"
    if not path.exists():
        die("Expected src/views/UnitView.vue was not found.")

    source = read(path)
    original = source

    # Guard legacy arbitrary profileOverride mutation. We only migrate save
    # fields through this old channel; base-stat changes require typed,
    # sourced, match-long PersistentModelModifier records.
    pattern = re.compile(
        r"Object\.entries\((?P<expr>[^)]*profileOverride[^)]*)\)"
        r"\.forEach\(\(\[(?P<key>\w+),(?P<val>\w+)\]\)=>\{"
        r"if\((?P=val)==='\+1'\)profile\[(?P=key)\]=[^;]+;"
        r"else profile\[(?P=key)\]=(?P=val)\}\)"
    )
    if pattern.search(source):
        import_line = "import { legacySaveOverridesOnly } from '../domain/profiles/profileResolver';"
        source, _ = add_import(source, import_line)
        source = pattern.sub(
            lambda m: (
                f"legacySaveOverridesOnly({m.group('expr')}).forEach((modifier)=>{{"
                "const stat=modifier.stat;"
                "if(modifier.operation==='set')profile[stat]=modifier.value;"
                "else if(modifier.operation==='improve-save'){"
                "const current=Number(profile[stat]);"
                "if(Number.isFinite(current))profile[stat]=Math.max(2,current-Number(modifier.value));"
                "}})"
            ),
            source,
        )

    # Refuse to leave the historical arbitrary profileOverride -> model-stat
    # mutation path behind. A changed source must be migrated deliberately.
    remaining_override_mutation = re.search(
        r"Object\.entries\([^)]*profileOverride[^)]*\)[\s\S]{0,1200}profile\s*\[",
        source,
        re.I,
    )
    if remaining_override_mutation:
        die(
            "UnitView.vue still contains a legacy profileOverride path that can "
            "write model characteristics. Convert it to persistent model/save "
            "or weapon modifiers before applying v0.032."
        )

    if source != original:
        write(path, source)
        return [str(path.relative_to(repo))]
    return []

def replace_unbold(text: str) -> tuple[str, int]:
    total = 0
    for label in ("Warhammer Fantasy Online Rules Index Project", "Nico Thiebes"):
        escaped = re.escape(label)
        text, count = re.subn(
            rf"<strong(?P<attrs>[^>]*)>\s*{escaped}\s*</strong>",
            lambda m: f"<span{m.group('attrs')}>{label}</span>",
            text,
            flags=re.I,
        )
        total += count
        text, count = re.subn(
            rf"<b(?P<attrs>[^>]*)>\s*{escaped}\s*</b>",
            lambda m: f"<span{m.group('attrs')}>{label}</span>",
            text,
            flags=re.I,
        )
        total += count
    return text, total

def remove_simple_action(text: str, label: str) -> tuple[str, int]:
    pattern = re.compile(
        rf"<(?P<tag>a|button)\b(?P<attrs>[^>]*)>\s*"
        rf"(?:<span[^>]*>\s*)?{re.escape(label)}(?:\s*</span>)?\s*"
        rf"</(?P=tag)>",
        re.I,
    )
    return pattern.subn("", text)

def add_discord_icon(text: str) -> tuple[str, int]:
    count = 0
    pattern = re.compile(
        r"<(?P<tag>a|button)\b(?P<attrs>[^>]*)>(?P<body>.*?)</(?P=tag)>",
        re.I | re.S,
    )
    def repl(match: re.Match) -> str:
        nonlocal count
        body = match.group("body")
        plain = re.sub(r"<[^>]+>", " ", body)
        if not re.search(r"\bDiscord\b", plain, re.I):
            return match.group(0)
        if re.search(r"<svg\b|discord-button-icon|discord-icon", body, re.I):
            return match.group(0)
        count += 1
        return (
            f"<{match.group('tag')}{match.group('attrs')}>"
            f"{DISCORD_SVG}{body}</{match.group('tag')}>"
        )
    return pattern.sub(repl, text), count

def remove_language_rows(text: str) -> tuple[str, int]:
    total = 0
    patterns = [
        re.compile(
            r"<label(?P<attrs>[^>]*)>\s*"
            r"(?:<span[^>]*>\s*)?Language(?:\s*</span>)?\s*"
            r"<select\b.*?</select>\s*</label>",
            re.I | re.S,
        ),
        re.compile(
            r"<div(?P<attrs>[^>]*(?:language-selector|footer-language|language-options)[^>]*)>"
            r".*?</div>",
            re.I | re.S,
        ),
    ]
    for pattern in patterns:
        text, count = pattern.subn("", text)
        total += count
    return text, total

def patch_ui(repo: Path) -> list[str]:
    candidates = []
    base = repo / "src"
    candidates.extend(base.rglob("*.vue"))
    candidates.extend(base.rglob("*.ts"))
    candidates.extend(base.rglob("*.html"))

    changed = []
    stats = {"unbold": 0, "actions": 0, "discord": 0, "language": 0}
    for path in sorted(set(candidates)):
        source = read(path)
        original = source

        source, count = replace_unbold(source)
        stats["unbold"] += count

        for label in ("Donation", "Donate", "Support"):
            source, count = remove_simple_action(source, label)
            stats["actions"] += count

        source, count = add_discord_icon(source)
        stats["discord"] += count

        source, count = remove_language_rows(source)
        stats["language"] += count

        if source != original:
            write(path, source)
            changed.append(str(path.relative_to(repo)))

    style = repo / "src/styles.css"
    if not style.exists():
        die("Expected src/styles.css was not found.")
    css = read(style)
    if CSS_MARKER not in css:
        write(style, css.rstrip() + "\n\n" + CSS_BLOCK)
        changed.append(str(style.relative_to(repo)))

    concrete = sum(stats.values())
    if concrete == 0:
        die(
            "None of the requested splash/footer UI anchors were found. "
            "Refusing to report a false success."
        )

    print(
        "[Old.dex v0.032] UI changes:",
        f"unbold={stats['unbold']},",
        f"removed-actions={stats['actions']},",
        f"discord-icons={stats['discord']},",
        f"language-controls={stats['language']}",
    )
    return changed

def update_version_strings(repo: Path) -> list[str]:
    changed = []
    for rel in ("src/App.vue", "src/components/AppHeader.vue", "src/components/AppFooter.vue"):
        path = repo / rel
        if not path.exists():
            continue
        source = read(path)
        updated = re.sub(r"\b0\.5[0-6]\b", PATCH_VERSION, source)
        if updated != source:
            write(path, updated)
            changed.append(rel)
    return changed

def ensure_no_github_artifacts(repo: Path) -> None:
    for pattern in ("ODX_V0*_VERIFICATION*", "ODX-V0*-VERIFICATION*"):
        for path in repo.rglob(pattern):
            if path.is_file():
                path.unlink()
                print(f"[Old.dex v0.032] removed obsolete verification artifact: {path.relative_to(repo)}")

    workflow_dir = repo / ".github/workflows"
    if workflow_dir.exists():
        for path in workflow_dir.glob("*"):
            if not path.is_file():
                continue
            name = path.name.lower()
            if (
                re.search(r"v0?5[0-7].*apply", name)
                or "verification" in name
                or "test-workflow" in name
                or "test_workflow" in name
            ):
                path.unlink()
                print(f"[Old.dex v0.032] removed obsolete temporary workflow: {path.relative_to(repo)}")

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply Old.dex v0.032 canonical profile foundation rebuild."
    )
    parser.add_argument(
        "repo",
        nargs="?",
        default=".",
        help="Path to the Old.dex repository root.",
    )
    args = parser.parse_args()
    repo = Path(args.repo).resolve()

    if not (repo / "src").is_dir():
        die(f"{repo} does not look like the Old.dex source root (src/ missing).")

    changed = []
    changed.extend(copy_payload(repo))
    changed.extend(patch_profile_source(repo))
    changed.extend(patch_unit_view(repo))
    changed.extend(patch_ui(repo))
    changed.extend(update_version_strings(repo))
    ensure_no_github_artifacts(repo)

    unique = sorted(set(changed))
    print(f"[Old.dex v{PATCH_VERSION}] applied {len(unique)} source file changes.")
    for rel in unique:
        print(f"  - {rel}")
    print(
        "[Old.dex v0.032] No GitHub workflow, ODX verification marker, "
        "or temporary CI artifact was created."
    )

if __name__ == "__main__":
    main()
