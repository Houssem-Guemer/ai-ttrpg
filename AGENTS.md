# AGENTS

## Project Outline
This repo is a lightweight, file-backed DnD-style narrator engine. The assistant (Codex) narrates and advances the story; the player responds with actions. Canon is stored in small JSON files to keep context consistent and minimal.

## Structure
- data/index.json: list of available stories.
- data/items.json: item dictionary by theme (name, description, default image).
- data/monsters.json: monster dictionary by theme (stats, description, default image).
- data/characters.json: reusable character dictionary by theme (major NPCs).
- data/factions.json: reusable faction dictionary by theme (name, description, default image).
- data/locations.json: reusable location dictionary by theme (name, description, default image).
- data/stories/<storyId>/story.json: story metadata and current scene.
- data/stories/<storyId>/world.json: world details (locations, lore hooks).
- data/stories/<storyId>/factions.json: guilds/groups/organizations.
- data/stories/<storyId>/characters/*.json: all characters, including the player.
- data/stories/<storyId>/log.json: running narrative log (short entries).
- scripts/roll_dice.js: CLI dice roller used to resolve checks.
- web/index.html: static UI to read stories and canon data.

## Data Model (Minimal)
- Character: id, name, appearance, background, inventory[], stats{}, status.
- Optional NPC visibility fields: publicStatus, publicNotes (only what the player would know).
- Inventory item: itemId, name, qty, notes.
- Item dictionary: theme -> items (id, name, description, defaultImage).
- Monster dictionary: theme -> monsters (id, name, description, defaultImage, stats).
- Character dictionary: theme -> characters (id, name, role, description, defaultImage, stats).
- Faction dictionary: theme -> factions (id, name, description, defaultImage, aliases[]).
- Location dictionary: theme -> locations (id, name, description, defaultImage, aliases[]).
- Log entry: turn, speaker, text, timestamp.
- Relationship notes: track faction/NPC attitude toward the player (friendly/neutral/hostile) in the relevant JSON files.
- Keep descriptions and aliases up to date as new canon is learned (items, factions, locations, characters, monsters).

## Narration Workflow
1) For new stories/games, use the start-story skill to run a structured setup. Ask for theme and setting, then the player's appearance and background. Ask if the player wants to introduce other characters (you will manage them) and whether they are present now or can be met later. Only accept player overrides during this setup phase.
2) Read the active story JSON files to establish canon.
3) Narrate the scene and ask the player what they do.
4) If a roll is needed (risky action), roll 1d6 using scripts/roll_dice.js and use the result.
5) Update story.json, character files, and log.json to reflect outcomes. Record any relationship changes (factions or NPCs) so continuity is preserved. Always log narrator, player, and NPC dialogue/actions. Do not accept player or inventory overrides after setup.

## Notes
- Keep descriptions compact; store only stable canon in JSON.
- Prefer small updates over large rewrites to avoid bloat.
- Each story is isolated by folder; multiple genres are supported.
- Enforce canon and consequences: contradict invalid actions or missing items, and apply realistic outcomes for reckless choices.
- When using reusable entries (items, characters, factions, locations, monsters), copy them into the story data first; only update the story copy after changes so shared bases stay unchanged.

## Quick Commands
- Roll dice (risky action): node scripts/roll_dice.js risky
- Open the UI: open web/index.html in a browser (or serve the repo root).
