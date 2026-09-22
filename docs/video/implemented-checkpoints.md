# Recorded implementation checkpoints

The course is built in chronological task commits. The following checkpoints run through Chapter 17 task 4; the final evidence/publication commit follows them. Each chapter PR is stacked on the preceding chapter to preserve its teaching diff. No history is squashed in the source branches.

## Chapter boundaries

| Chapter | First task commit | Last implementation checkpoint | Task commits | Teaching guide                                    |
| ------- | ----------------- | ------------------------------ | ------------ | ------------------------------------------------- |
| 0       | 1186b8e           | 7f7a4a7                        | 6            | [Foundation](../../PRPs/00-project-foundation.md) |
| 1       | 38fed56           | 87ca4b4                        | 6            | [Chapter 1](../chapters/01-learning-guide.md)     |
| 2       | 903c00d           | 1f44038                        | 5            | [Chapter 2](../chapters/02-learning-guide.md)     |
| 3       | 1e03352           | 1794710                        | 5            | [Chapter 3](../chapters/03-learning-guide.md)     |
| 4       | ae8bd4f           | 08ea1e0                        | 5            | [Chapter 4](../chapters/04-learning-guide.md)     |
| 5       | 0fab906           | a614869                        | 5            | [Chapter 5](../chapters/05-learning-guide.md)     |
| 6       | 92d48db           | b1366bc                        | 5            | [Chapter 6](../chapters/06-learning-guide.md)     |
| 7       | 6d96aec           | 836e760                        | 5            | [Chapter 7](../chapters/07-learning-guide.md)     |
| 8       | 2d5ba68           | 89e8383                        | 5            | [Chapter 8](../chapters/08-learning-guide.md)     |
| 9       | 63d2b22           | 03f3fe7                        | 6            | [Chapter 9](../chapters/09-learning-guide.md)     |
| 10      | 8f0c8f7           | 0056e0e                        | 5            | [Chapter 10](../chapters/10-learning-guide.md)    |
| 11      | b57ba97           | 2e25227                        | 5            | [Chapter 11](../chapters/11-learning-guide.md)    |
| 12      | f83558d           | 28a22af                        | 5            | [Chapter 12](../chapters/12-learning-guide.md)    |
| 13      | 15b92be           | 868805a                        | 6            | [Chapter 13](../chapters/13-learning-guide.md)    |
| 14      | edc9348           | 218d058                        | 6            | [Chapter 14](../chapters/14-learning-guide.md)    |
| 15      | 896041b           | 1785e0f                        | 5            | [Chapter 15](../chapters/15-learning-guide.md)    |
| 16      | f1297bf           | d106606                        | 4            | [Chapter 16](../chapters/16-learning-guide.md)    |
| 17      | 878e4d3           | 27736c3                        | 4            | [Chapter 17](../chapters/17-learning-guide.md)    |

## Replay a chapter for recording

Read its definition contract and learning guide first. View the chronological log and the change for a selected task:

```bash
git log --reverse --oneline --grep="^chapter-9 task-"
git show 05961ee
```

Use a separate checkout for historical demonstrations so a current private SQLite database is never opened by older code. Each lesson identifies expected values, deliberately rejected inputs, package verification tier and remaining limits. Use synthetic fixtures on camera. Keep provider history, account holdings and access credentials out of public artifacts.

The complete implementation is on codex/chapter-17-governance-recovery. Read docs/progress.md for actual checks and corrective commits. Specialist extensions are described separately in PRPs/extensions.md; they are not implied by completion of the core course.
