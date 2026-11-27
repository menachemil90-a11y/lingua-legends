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
Online matches: the server computes XP, shards and the match-based achievements (First Victory, Podium Finish, Combo Master)
and stores them per player; a player who forfeits earns no shards. Offline (vs bot) rewards stay on the device.
After any match, **Practise my mistakes** replays the public items that were missed; ranked (server-only) items are
replaced by public items that share their vocabulary/grammar tags at a nearby level, so the answer keys stay private.

## Tournaments
**Champion's Cup (offline):** pick a 1v1 mode, a language bracket and a difficulty; play a quarter-final, semi-final and
final against labelled bots that get stronger each round (standard: Rookie → Adept → Veteran; hard: Adept → Veteran →
Champion). A draw replays the round; a loss ends the run without penalties. Winning grants the *Cup Champion* title.

**Friends' tournaments (online, unranked):** 3–8 players join by code or invite link; the host starts. The server seeds a
single-elimination bracket (4 or 8 slots, byes for top seeds), launches every match automatically (8 s after the previous
round so players can read their results), and advances winners. Draws go to more correct answers, then the faster average
answer, then the better seed — never chance. Missing a ready check or leaving gives a walkover. The champion earns
60 XP + 30 shards and the *Tournament Champion* achievement/title; the finalist 30 XP + 15 shards (all server-side).
While in a tournament a player cannot join queues, rooms or challenges, so nobody is double-booked.

## Adventure
Regions: Word Arena, Grammar Circuit, Sentence Citadel, Mystery District, Academic Summit. Chapters unlock in order,
bosses reuse earlier material, stars from accuracy thresholds. All content remains available in Practice regardless of progress.

## Escape Room (solo)
Three original rooms — The Clockmaker's Workshop (A2), Last Train from Platform 9 (B1), The Observatory at Midnight (B2) — each with
illustrated hotspots. Puzzle kinds: multiple choice, typed word (normalised, articles ignored) and ordering steps.
Each puzzle has a hint; first-try solves and hints used are shown at the end. Relaxed mode counts up; timed mode counts
down; when it reaches zero the player is invited to keep going in relaxed mode (no penalty).

**Co-op online (2–4 friends, private room, unranked).** Each language bracket opens one room (foundation → Clockmaker,
core → Platform 9, advanced → Observatory). Anyone can open any lock; the server checks every answer and shares each
attempt, hint and opened lock with the whole team ("Gal opened 'Timetable board'"). The team has 1.5× the solo time;
running out is a shared draw — never a defeat — and every opened lock still counts as learning. Leavers do not stop the team. Co-op is planned.

## English Conquest (vs bots)
Original 12-island archipelago, factions Azure, Gilded, Violet and Ember. Each turn: answer a question (correct → +3 gold
and a +2 Focus bonus for the next attack), then up to 3 actions — recruit (2 gold), fortify (5 gold, +2 defence),
move, attack. Attack succeeds when troops + focus > defenders + fort; the preview shows the exact odds before you commit.
Win by holding 8 islands, or after 12 rounds by most islands, then most troops. Bots use the same rules
(`packages/shared/src/rules/conquest.ts`) and are labelled as bots.

**Online (private rooms, 2–4 friends, unranked).** The server's `ConquestHost` owns the state. Only the active player
receives the question (the key stays on the server until they answer); everyone sees the board, gold and log update live.
A turn has a question timer from the item and 45 s for actions, and passes automatically when the three actions are spent.
An absent player's turn is skipped after 8 s (no bonus); after 60 s away — or on leaving — their islands turn neutral and
the others play on. The last player standing wins by forfeit. Leavers earn no shards.

## Debate Arena (private practice)
Pick one of 10 motions (B1–C2) and a side. Write an opening, read the other side's *prepared* argument (clearly labelled as
prepared text, not AI), write a rebuttal, read their prepared closing, then write your own closing. The review shows an
8-point checklist (clear position, reasons, example, counter-argument answered, ≥4 connectors, every part within its word
target, a real summary, no flagged common errors) — habits present, never a grade, and never used as proficiency evidence.
Each motion has a phrase bank and key vocabulary with Hebrew glosses; past debates are kept on the device.
Live debates between players are intentionally not offered: they would require free text between players. A rule-based checker
(`packages/learning/src/writingCheck.ts`) reports length, stance, reasons, examples, concession + rebuttal, hedging,
connectors, long sentences and common errors. It is clearly labelled as an automatic structure check, not AI or a teacher.

## Planned modes
Co-op Escape Room, Debate Arena AI feedback (once approved), full Real Life (speech once approved),
more Detective cases. See `docs/ROADMAP.md`.
