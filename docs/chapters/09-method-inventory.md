# Chapter 9 — Released construction methods

## Release checkpoint

The dependency upgrade is already committed as 63d2b22. fintech-algorithms 0.13.2 exposes 20 D14 topics. Every D14 topic is contract tier: the upstream release checks shape but does not independently certify numeric results. This application adds independent small examples and propagates solver certificates.

The installed skill, lookup output, declarations and implementation were inspected before choosing these imports.

| Method                    | Import suffix / export                                                                                                                                                   | Accepted domain                                                                          | Result gate                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Equal initial weights     | index-and-benchmark-engineering/weighting-and-capping/equal-weight-index / calculate                                                                                     | Ordered IDs, zero comparison returns                                                     | Verified shared-fixture baseline; exact 1/N                                    |
| Global minimum variance   | portfolio-construction/mean-risk-optimization/global-minimum-variance / globalMinimumVariance                                                                            | General N, symmetric PSD supplied covariance, long-only simplex                          | status optimal; preserve solutionClass, iterations, gaps and warnings          |
| Inverse volatility        | portfolio-construction/risk-allocation/inverse-volatility-weighting / inverseVolatilityWeights                                                                           | Positive standalone volatilities in matching units                                       | status ok; covariance is used for diagnostics, not for choosing these weights  |
| Turnover constrained      | portfolio-construction/practical-constraints/turnover-constrained-optimization / solveTurnoverConstrainedMarkowitz                                                       | General N, simple annual means/covariance, normalized current holdings, half-L1 turnover | status optimal; max-iterations never becomes a usable candidate                |
| Portfolio risk diagnostic | foundations/financial-risk-and-performance-statistics/covariance-matrices-portfolio-variance-and-diversification / covarianceMatricesPortfolioVarianceAndDiversification | Ordered weights summing to one, augmented cash covariance                                | Verified shared-fixture diagnostic; independently check variance contributions |

All paths begin fintech-algorithms/. D14 methods retain contract-tier labeling. D03 and D00 methods are verified shared-fixture parity.

## Four families in the video

1. Mean-risk optimization: Markowitz, global minimum variance, maximum Sharpe, mean-CVaR and mean-absolute deviation. Implement global minimum variance first; it does not need expected-return forecasts.
2. Risk allocation: inverse volatility, equal risk contribution, risk budgeting, hierarchical risk parity and hierarchical equal risk contribution. Implement inverse volatility; explicitly explain that it ignores covariance when assigning capital.
3. Bayesian/robust allocation: Black–Litterman, resampled frontier, robust mean-variance, distributionally robust portfolio and Kelly. These are documented extensions, not buttons backed by substitute formulas. They require view, uncertainty, scenario and objective contracts beyond this chapter.
4. Practical constraints: turnover, transaction-cost-aware, cardinality, gross/net and tax-aware allocation. Implement released turnover optimization and separately audit mandate bounds and estimated costs. Tax lots become a later execution-planning lesson; jurisdictional tax rules are not inferred.

## Scope of each certificate

GMV solves the risky simplex, then the application scales its weights by a selected fixed risky budget 1−cash. Its optimum is conditional on that fixed cash reserve. No expected return, sector cap, position cap or turnover constraint is secretly included in the GMV objective.

Turnover optimization includes an explicit final cash coordinate with zero covariance and zero assumed return. It solves annual mean minus lambdaRisk times annual variance, with long-only unit budget and half-L1 turnover including cash. Its cash weight is endogenous. The fixed-cash field only applies to the three baseline methods.

None of these selected exports jointly enforces every mandate restriction. The application audits the resulting candidate and rejects policy breaches without clipping or renormalizing weights. Rejection of one candidate is not a proof that every portfolio is infeasible. A separate capacity preflight may prove conflicting bounds infeasible. Solver failure, unsupported inputs, candidate rejection and proven infeasibility have different states.

Transaction cost is an explicit estimate on absolute risky-asset weight changes, excluding the cash coordinate, with basis points and a maximum cost budget. It is not deducted inside the selected GMV or turnover objective. Chapter 11 must fund actual quantities and fees and recheck the mandate.

## Solver details and independent acceptance

GMV uses projected gradient on the simplex with line search. Default maxIterations is 10,000; the application bounds user budgets and permits zero for the deliberate failure lesson. Read status, iterations, solutionClass, budgetResidual, lowerBoundResidual and Frank–Wolfe gaps. Singularity does not automatically imply failure; a non-unique optimum must be labeled.

Turnover uses projection onto the simplex intersected with an L1 ball. Default maxIterations is 5,000. Its certificate reports stationarity, Frank–Wolfe gap, objective-gap bound and normalized tolerance. Preserve max-iterations explicitly.

Independent acceptance cases:

- Covariance diag(0.04,0.04) produces 50/50 and variance 0.02 with no cash.
- [[0.04,0.01],[0.01,0.09]] produces weights 8/11 and 3/11.
- Volatilities 0.1 and 0.2 produce inverse-volatility weights 2/3 and 1/3.
- Turnover example mean [0.1,0.04], covariance diag(0.04,0.01), lambda 1, current [0.6,0.4], cap 0.1 gives [0.7,0.3]. The unconstrained stationary first weight is 0.8; the turnover boundary limits it to 0.7.
- Asset permutation preserves the economics after mapping back.
- An exhausted iteration budget cannot become a proposal.

## Primary reference context

[MOSEK's transaction-cost formulation](https://docs.mosek.com/portfolio-cookbook/transaction.html) makes explicit that actual costs affect financing constraints. The chapter's estimated-cost audit is therefore not described as a self-financing cost-aware optimization. The installed D14 source defines the exact algorithms and tolerances used by this application.
