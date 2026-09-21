# Full-domain curriculum map

Snapshot: 2026-09-22. This maps all 50 domains in The Fintech Builder master catalog to the main portfolio course or an explicit extension. Counts measure availability, not correctness or completed Portfolio Atlas features.

The source catalog contains 1,720 topics; its current release manifest records 717 packaged topics. The installed npm 0.13.1 payload contains 697 topics. The D14 release is the only domain present in the current project package list and absent from this npm snapshot. Individual contracts still need verification before use.

| Domain                                                        | Place in the course                                    | Catalog packages / named topics | Installed npm topics |
| ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------- | -------------------- |
| D00 — Financial Mathematics, Statistics, and Data Foundations | Foundations throughout                                 | 120/120                         | 120                  |
| D01 — Market Data Engineering                                 | Chapters 2–4; intraday extension                       | 31/31                           | 31                   |
| D02 — Corporate Actions and Security Master Data              | Chapters 2–5 and 10                                    | 20/20                           | 20                   |
| D03 — Index and Benchmark Engineering                         | Chapter 6; benchmark extensions                        | 40/40                           | 40                   |
| D04 — Market Breadth and Internals                            | Chapter 7                                              | 28/28                           | 28                   |
| D05 — Correlation, Dependence, and Networks                   | Chapter 8; dependence extension                        | 0/40                            | 0                    |
| D06 — Price Action and Candlesticks                           | Chapters 3 and 7; optional pattern context             | 52/52                           | 52                   |
| D07 — Technical Indicators                                    | Chapter 7; selected methods only                       | 137/137                         | 137                  |
| D08 — Geometric Chart Patterns                                | Chapter 7; optional pattern context                    | 64/87                           | 64                   |
| D09 — Statistical Time Series                                 | Chapters 7–8; forecasting extension                    | 37/46                           | 37                   |
| D10 — Volatility and Covariance                               | Chapter 8                                              | 22/22                           | 22                   |
| D11 — Market Microstructure                                   | Chapter 12; intraday extension                         | 29/29                           | 29                   |
| D12 — Matching Engines and Venue Logic                        | Chapter 12; order lifecycle                            | 21/21                           | 21                   |
| D13 — Execution and Transaction Cost Analysis                 | Chapters 10, 12 and 15; TCA extension                  | 9/19                            | 9                    |
| D14 — Portfolio Construction                                  | Chapter 9; explicit npm release gate                   | 20/20                           | 0                    |
| D15 — Investment Risk                                         | Chapters 8 and 14                                      | 0/20                            | 0                    |
| D16 — Performance and Attribution                             | Chapters 15–16                                         | 0/20                            | 0                    |
| D17 — Factor Investing and Asset Pricing                      | Chapters 7–9 and 15; factor extension                  | 0/30                            | 0                    |
| D18 — Fundamental Analysis and Valuation                      | Chapter 7; valuation extension                         | 52/89                           | 52                   |
| D19 — Financial Statement Intelligence                        | Chapter 7; statement-data extension                    | 0/37                            | 0                    |
| D20 — Fixed Income and Interest Rates                         | Direct-bond extension; Chapter 6 interface             | 0/25                            | 0                    |
| D21 — Credit Risk and Default                                 | Credit extension                                       | 7/27                            | 7                    |
| D22 — Derivatives and Options                                 | Derivatives extension                                  | 0/24                            | 0                    |
| D23 — Commodities and Futures                                 | Futures/commodities extension                          | 0/18                            | 0                    |
| D24 — Foreign Exchange                                        | Chapters 4, 6 and 15; FX hedge extension               | 0/17                            | 0                    |
| D25 — Digital Assets and On-Chain Finance                     | Digital-asset extension                                | 10/57                           | 10                   |
| D26 — Islamic Finance and Sharia Screening                    | Sharia-mandate extension                               | 0/23                            | 0                    |
| D27 — Lending and Underwriting                                | Optional lending product integration                   | 0/24                            | 0                    |
| D28 — Payments and Money Movement                             | Optional account-funding integration                   | 0/25                            | 0                    |
| D29 — Fraud, AML, and Financial Crime                         | Optional financial-crime controls                      | 0/31                            | 0                    |
| D30 — Banking Ledger and Reconciliation                       | Chapters 5, 13 and 17                                  | 0/28                            | 0                    |
| D31 — Treasury, Liquidity, and Asset-Liability Management     | Cash/liability management extension                    | 0/20                            | 0                    |
| D32 — Insurance and Actuarial Science                         | Optional insurance product integration                 | 0/20                            | 0                    |
| D33 — Wealth and Robo-Advice                                  | Chapters 1 and 11; goal/household extension            | 0/20                            | 0                    |
| D34 — Tax-Lot and Accounting Optimization                     | Chapters 5 and 11; jurisdiction-specific tax extension | 0/15                            | 0                    |
| D35 — Financial NLP and Document Intelligence                 | Chapter 7/16 evidence seams; NLP extension             | 0/20                            | 0                    |
| D36 — Alternative Data Analytics                              | Alternative-data extension                             | 0/19                            | 0                    |
| D37 — Forecasting and Machine Learning                        | Forecasting extension                                  | 0/33                            | 0                    |
| D38 — Causal Inference and Experimentation                    | Causal-evaluation extension                            | 0/18                            | 0                    |
| D39 — Optimization and Simulation                             | Chapters 8–10; solver/simulation methods               | 0/20                            | 0                    |
| D40 — Model Validation and Backtesting                        | Chapter 10; ongoing validation                         | 10/37                           | 10                   |
| D41 — Explainability, Fairness, and Governance                | Chapters 14, 16 and 17                                 | 0/19                            | 0                    |
| D42 — Digital Identity and Trust                              | Chapter 17                                             | 0/19                            | 0                    |
| D43 — Clearing, Settlement, and Custody                       | Chapters 12–13                                         | 0/19                            | 0                    |
| D44 — Product Pricing and Unit Economics                      | Optional billing and product-economics integration     | 0/19                            | 0                    |
| D45 — Regulatory and Compliance Automation                    | Chapters 1, 12–17; jurisdiction-specific extensions    | 0/27                            | 0                    |
| D46 — Earnings and Per-Share Analytics                        | Chapter 7; earnings extension                          | 8/49                            | 8                    |
| D47 — Corporate Forecasting and Financial Model Engineering   | Forecasting/financial-model extension                  | 0/52                            | 0                    |
| D48 — Fair Value Measurement and Valuation Control            | Chapter 6 policy; advanced valuation extension         | 0/47                            | 0                    |
| D49 — Financial Cybersecurity Engineering                     | Chapter 17; operational security                       | 0/40                            | 0                    |

## How to interpret the gaps

A zero npm count requires explicit application implementation or a later verified package release; it is not permission to guess an export. Nonzero domain coverage can still be partial. For example, baseline D40's ten functions concern score validation rather than the entire backtesting roadmap, and D13 contains nine topics across two families.

The main course emphasizes a complete lifecycle for its supported instruments. Extensions must bring their own contracts, accounting/valuation semantics and validation. See [extension PRP](../PRPs/extensions.md) and [installed capability inventory](references/dependency-capabilities.json).
