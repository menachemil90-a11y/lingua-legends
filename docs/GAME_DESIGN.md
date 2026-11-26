# Game design

Core loop: **choose a mode → short match (2–3 min) → satisfying feedback → see learning progress → review mistakes → choose whether to play again.**
Players can always stop after a match. Nothing punishes missing a day.

## Universe
Original "Lingua Legends" realm: deep-navy skies, cyan glyph energy, purple arcane light, gold accents.
Heroes (original): **Vexa** (Glyph Duelist, hooded mage with a crystal blade), **Kael** (Rune Warden, armoured knight
with a rune shield), **Nyra** (Storm Archer, crescent energy bow), **Torque** (Clockwork Sentinel, gear-core robot).
Vehicles: Comet GT, Viper X, Aurum Royale, Ember Nova. All art is code-generated SVG (`apps/web/src/art`).

## Word Battle (1v1)
| Rule | Value (see `packages/shared/src/rules/wordBattle.ts`) |
| --- | --- |
| HP | 100 each |
| Match clock | 150 s; the round in progress when it expires is the final round |
| Round time | from the item (12 s typical, 25 s reading) |
| Correct answer | attack for **10 + speed bonus (0–4)**, bonus = round(4 × time remaining fraction) |
| Wrong / no answer | missed attack opportunity, combo resets |
| Combo | 3 consecutive correct answers charge one ability (max 1 stored) |
| Abilities | **Shield** blocks the next incoming attack; **Surge** next hit × 1.8; **Focus** restores 12 HP |
| End | KO (0 HP) → other player wins; both 0 in the same round → draw; timeout → higher HP wins, equal HP → draw |
| Disconnect | 30 s grace, then forfeit; both gone → cancelled |

Balance notes: speed can add at most 40 % to base damage, so accuracy dominates. Typical match ≈ 13–16 rounds; a 70 %
accurate player KOs an inaccurate one in about two minutes. Both answers resolve simultaneously; attack order in the animation follows the result list.

## Grammar Race (2–4 racers)
Physics in `packages/shared/src/rules/grammarRace.ts`: cruise 6 m/s, +5 m/s boost per correct answer decaying with τ = 4 s
(cap 20), turbo +9 m/s for 2.5 s every 3 consecutive correct answers, wrong answer → boost wiped + 1.2 s stall at 2 m/s.
Track 1000 m, 150 s max, others get 12 s after the first finisher. Positions: finish time, then distance.
**Accuracy beats speed:** a wrong answer costs more distance than a correct one gains (unit test:
careful 95 % @ 5 s beats fast guesser 50 % @ 2.5 s). Every racer gets the same question sequence.

## Sentence Master
Players order shuffled word tiles (comma tiles where needed). Every listed valid order is accepted (e.g. time
phrase at the start or end). Duel: 5 rounds, 2 attempts each; first try 100 + up to 25 speed bonus, second try 60 + half bonus;
higher total wins, equal → draw. Practice mode: untimed, adaptive difficulty (two correct in a row → harder level),
structural feedback ("the order is correct up to … the next word should be …") plus item-specific common-mistake notes.
Input: tap, drag (pointer events, works on touch), keyboard (1–9 pick, Backspace undo, ←/→ reorder, Enter check).

## Bots
Tiers Rookie/Adept/Veteran/Champion (accuracy 55–90 %, speed 32–62 % of the time limit), adjusted by item level.
Bots play through the same host API (no rule bending) and are always labelled "BOT". Online queues never contain bots;
after 30 s of searching the player is *offered* a bot match.

## Competitive ranking
Bronze → Silver → Gold → Platinum → Diamond (III/II/I divisions of 100 rating points), Master (2100+), Legend (2400+).
Elo with K = 64 during 5 placement matches, 40 until 30 games, then 28. Ratings are per **mode × language bracket × season**
(foundation A1–A2, core B1–B2, advanced C1–C2), so an A2 player can be Diamond in the foundation bracket.
Matchmaking pairs the closest rating within a window that widens with waiting time and never pairs blocked players.
Rematches are unranked to prevent rating farming. No outcome manipulation of any kind.

## Progression & rewards
XP per match = 20 participation + 4 × correct + outcome (25/15/8) + combo (≤ 15) — losing still earns XP.
Shards (cosmetic currency) are earned only by playing; nothing is for sale. Cosmetics are deterministic unlocks
(level or achievement) and never affect gameplay. Weekly Momentum shows active days this week (Sunday-first) and never removes progress.
Achievements: First Victory, Podium Finish, Architect, Wordsmith, Combo Master, On Fire, Scholar, Know Thyself, Memory Keeper.

## Adventure
Regions: Word Arena, Grammar Circuit, Sentence Citadel, Mystery District, Academic Summit. Chapters unlock in order,
bosses reuse earlier material, stars from accuracy thresholds. All content remains available in Practice regardless of progress.

## Planned modes
English Conquest (strategy, 2–4), Escape Room (solo/co-op), Debate Arena (writing + AI feedback once approved),
full Real Life (speech once approved), more Detective cases. See `docs/ROADMAP.md`.
