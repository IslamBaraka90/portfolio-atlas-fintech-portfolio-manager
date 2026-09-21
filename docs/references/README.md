# Reference and evidence register

Checked for the planning foundation on 2026-09-22. Recheck version-sensitive details at implementation time.

| Source                                                                           | Role                                            | Authority boundary                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Installed fintech-algorithms 0.13.1 docs.json and declarations                   | Algorithm registry and call contracts           | This installed release, not future catalog capability    |
| Installed fintech-algorithms bundled skill                                       | Discovery, ingestion, and failure-mode guidance | Some static counts are stale; inspect payload fields     |
| Installed yahoo-finance2 4.0.2 declarations and bundled skill                    | Provider methods and response shapes            | Unofficial Yahoo client; some skill prose still names v3 |
| [Fintech reference](https://docs.thefintechbuilder.com/reference/)               | Public algorithm documentation                  | Website can lead npm                                     |
| [Data provider guide](https://docs.thefintechbuilder.com/guides/data-providers/) | Provider/adapter/validation boundary            | Generic examples need topic-specific contract checks     |
| [Yahoo repository](https://github.com/gadicc/yahoo-finance2)                     | Upstream provider documentation                 | Runtime data availability varies                         |
| The Fintech Builder master catalog                                               | Stable Dxx-Fxx-Axx learning identity            | A planned topic is not a shipped function                |

The private parent catalog is used to map course topics, but this repository does not require its absolute path, copy private reports, or depend on it at runtime. Stable topic IDs in PRPs preserve the connection. Verify public article links before adding them.

## Required chapter evidence

Distinguish synthetic teaching input, provider observation, documented definition, implementation choice, package parity, independent calculation, and empirical result. Every chapter must add the primary financial sources necessary for the exact variant it implements, with version/jurisdiction where relevant.

Do not claim an observed historical case until identity, time, adjustment basis, availability, and reuse permissions have been checked. Catalog outlines are research leads, not evidence for all the claims implied by a topic title.
