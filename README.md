# Codex DnD Narrator

A lightweight, file-backed DnD-style narrator engine. The assistant narrates the world, you choose actions, and the canon lives in small JSON files so the story stays consistent. Multiple stories (fantasy, sci-fi, etc.) can live side by side.

## Features
- Canon stored in JSON for consistency (world, factions, characters, log).
- Simple risky-action dice system (1d6: fail/mixed/success).
- Static web UI to browse story data and the narrative log.
- Multiple stories supported under `data/stories/`.

## Project Structure
- `data/index.json`: list of available stories.
- `data/stories/<storyId>/story.json`: story metadata and current scene.
- `data/stories/<storyId>/world.json`: locations and lore hooks.
- `data/stories/<storyId>/factions.json`: guilds and organizations.
- `data/stories/<storyId>/characters/*.json`: player and NPC files.
- `data/stories/<storyId>/log.json`: narrative log (all dialogue/actions).
- `scripts/roll_dice.js`: CLI dice roller.
- `web/index.html`: read-only UI for stories.

## Quick Start
1) Open the story UI
```bash
python -m http.server
```
Then visit `http://localhost:8000/web/`.

2) Roll dice for risky actions
```bash
node scripts/roll_dice.js risky
```

3) Start playing
Tell the narrator what your character does. The narrator will update JSON canon as the story progresses.

## Story Setup Rules
- New stories use a structured setup: theme/setting, player appearance/background, and optional additional characters.
- Player overrides are only accepted during setup.
- Narrator enforces canon and consequences for invalid or reckless actions.

## Notes
- The example story lives in `data/stories/starter-fantasy/`.
- All other story folders are ignored by git per `.gitignore`.
