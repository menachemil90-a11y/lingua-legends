# Success metrics

Lingua Legends optimises for **long-term English improvement and enjoyment**, not screen time.
No metric below should be pursued with manipulative mechanics (see CLAUDE.md wellbeing rules).
Collection must be privacy-preserving and, for minors, consented where required. None of these are collected yet.

## Educational outcomes
| Metric | Definition | Source |
| --- | --- | --- |
| Delayed recall | Accuracy on a knowledge component when it returns ≥ 1 day (and ≥ 7 days) after first exposure | `learning_events` + review schedule |
| Transfer | Accuracy on a tag in a *different* mode/context than where it was learned | events grouped by tag × mode |
| Skill growth | Change in per-skill θ estimate over 2/6/12 weeks, with confidence | skill profiles |
| Reading comprehension | Accuracy on unseen passages by level over time | reading items |
| Writing | Checklist completion and (later) teacher-rated samples; AI scores never used as ground truth | Bagrut tasks |
| Mistake reduction | Frequency of each error category per 100 answers over time | error categories |

## Enjoyment & engagement (healthy)
| Metric | Definition |
| --- | --- |
| Voluntary rematch rate | Share of matches followed by a rematch both players accepted |
| Session satisfaction | Optional 1-tap rating after some matches |
| Return within 7 days | Players who come back on their own (no streak pressure) |
| Healthy session length | Median session length; watch for *very* long sessions as a wellbeing signal, not a goal |

## Match quality & fairness
| Metric | Definition |
| --- | --- |
| Match completion | Matches ending by KO/timeout/finish vs forfeits/cancellations |
| Rating fairness | Predicted vs actual win rate (Elo calibration) per bracket |
| Queue time | Median/90th percentile time to match per queue |
| Close matches | Share of Word Battles decided by ≤ 20 HP / races by ≤ 5 s |
| Bot calibration | Player win rate vs each bot tier (target ~45–60 %) |

## Technical performance
| Metric | Target |
| --- | --- |
| First load (mobile, 4G) | < 3 s to interactive lobby; Phaser loaded lazily |
| Frame rate in matches | ≥ 50 fps on mid-range phones |
| WebSocket round trip | p95 < 250 ms in-region |
| Reconnection success | > 95 % within the 30 s grace window |
| Server errors | < 0.1 % of messages |
