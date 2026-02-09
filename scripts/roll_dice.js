#!/usr/bin/env node
"use strict";

function parseDice(expr) {
  const match = expr.trim().match(/^([0-9]+)d([0-9]+)([+-][0-9]+)?$/i);
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const mod = match[3] ? Number(match[3]) : 0;
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return null;
  return { count, sides, mod };
}

function roll(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i += 1) {
    rolls.push(1 + Math.floor(Math.random() * sides));
  }
  return rolls;
}

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/roll_dice.js risky | 1d20+3");
  process.exit(1);
}

if (input.toLowerCase() === "risky") {
  const [rollValue] = roll(1, 6);
  let outcome = "mixed";
  if (rollValue <= 2) outcome = "fail";
  if (rollValue >= 5) outcome = "success";
  console.log(`1d6 => [${rollValue}] = ${outcome}`);
  process.exit(0);
}

const spec = parseDice(input);
if (!spec) {
  console.error("Invalid dice expression. Use NdM or NdM+K (e.g. 2d6+1), or 'risky'.");
  process.exit(1);
}

const rolls = roll(spec.count, spec.sides);
const total = rolls.reduce((a, b) => a + b, 0) + spec.mod;

const modLabel = spec.mod === 0 ? "" : spec.mod > 0 ? `+${spec.mod}` : `${spec.mod}`;
console.log(`${spec.count}d${spec.sides}${modLabel} => [${rolls.join(", ")}] ${modLabel} = ${total}`);
