# AGENTS

## Project Outline
This repo is a lightweight, file-backed DnD-style narrator engine. The assistant (Codex) narrates and advances the story; the player responds with actions. Canon is stored in small JSON files to keep context consistent and minimal.

## Structure
- data/index.json: list of available stories.
- data/stories/<storyId>/story.json: story metadata and current scene.
- data/stories/<storyId>/world.json: world details (locations, lore hooks).
- data/stories/<storyId>/factions.json: guilds/groups/organizations.
- data/stories/<storyId>/characters/*.json: all characters, including the player.
- data/stories/<storyId>/log.json: running narrative log (short entries).
- scripts/roll_dice.js: CLI dice roller used to resolve checks.
- web/index.html: static UI to read stories and canon data.

## Data Model (Minimal)
- Character: id, name, appearance, background, inventory[], stats{}, status.
- Inventory item: name, qty, notes.
- Log entry: turn, speaker, text, timestamp.
- Relationship notes: track faction/NPC attitude toward the player (friendly/neutral/hostile) in the relevant JSON files.

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

## Quick Commands
- Roll dice (risky action): node scripts/roll_dice.js risky
- Open the UI: open web/index.html in a browser (or serve the repo root).
