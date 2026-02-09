# Codex DnD Narrator

A lightweight, file-backed DnD-style narrator engine. The assistant narrates the world, you choose actions, and the canon lives in small JSON files so the story stays consistent. Multiple stories (fantasy, sci-fi, etc.) can live side by side.

## Features
- Canon stored in JSON for consistency (world, factions, characters, log).
- Theme-based item dictionary with optional images.
- Theme-based monster and reusable character dictionaries.
- Reusable locations and factions for each theme.
- Simple risky-action dice system (1d6: fail/mixed/success).
- Static web UI to browse story data and the narrative log.
- Multiple stories supported under `data/stories/`.

## Project Structure
- `data/index.json`: list of available stories.
- `data/items.json`: item dictionary by theme.
- `data/monsters.json`: monster dictionary by theme.
- `data/characters.json`: reusable character dictionary by theme.
- `data/factions.json`: reusable faction dictionary by theme.
- `data/locations.json`: reusable location dictionary by theme.
- `data/stories/<storyId>/story.json`: story metadata and current scene.
- `data/stories/<storyId>/world.json`: locations and lore hooks.
- `data/stories/<storyId>/factions.json`: guilds and organizations.
- `data/stories/<storyId>/characters/*.json`: player and NPC files.
- `data/stories/<storyId>/characters/index.json`: optional list of story characters for the UI.
- `data/stories/<storyId>/log.json`: narrative log (all dialogue/actions).
- `scripts/roll_dice.js`: CLI dice roller.
- `web/index.html`: read-only UI for stories.

## Quick Start
1) Start the local server (required for uploads)
```bash
node scripts/server.js
```
Then visit `http://localhost:8000/web/`.

2) (Optional) Use a simple read-only server
```bash
python -m http.server
```
This serves the UI but uploads will fail. Use the Node server above for image uploads.

Image library: `http://localhost:8000/web/library.html`.

3) Roll dice for risky actions
```bash
node scripts/roll_dice.js risky
```

4) Start playing
Tell the narrator what your character does. The narrator will update JSON canon as the story progresses.

## Items & Images
- Items are defined in `data/items.json` per theme (e.g., fantasy vs sci-fi).
- Inventory entries reference items by `itemId`.
- The UI lets you upload images for items. These are stored in the browser's local storage for your machine.
- If no custom image is uploaded, a default image from `assets/` is shown.
- Use `web/library.html` to upload images for items, monsters, factions, locations, and characters.

## Monsters & Reusable Characters
- Reusable monsters live in `data/monsters.json`.
- Reusable major characters live in `data/characters.json`.
- Story-specific NPCs remain in `data/stories/<storyId>/characters/`.

## Reusable Locations & Factions
- Reusable factions live in `data/factions.json`.
- Reusable locations live in `data/locations.json`.
- Story-specific factions/locations stay in each story's `world.json`/`factions.json`.

## Story Setup Rules
- New stories use a structured setup: theme/setting, player appearance/background, and optional additional characters.
- Player overrides are only accepted during setup.
- Narrator enforces canon and consequences for invalid or reckless actions.

## Notes
- The example story lives in `data/stories/starter-fantasy/`.
- All other story folders are ignored by git per `.gitignore`.
