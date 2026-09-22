# Chapter 17 — prove authority and rehearse recovery

## The final lesson

Open **Governance & recovery**. A fresh installation identifies the local OS owner and explicitly allows solo approvals. For the governed demonstration, follow the [access runbook](../runbooks/access-and-incidents.md): provision random credentials, configure the private policy path and restart. No real credential belongs in the video or Git history.

The database binds to the configured workspace. Removing authentication configuration or changing its scope fails startup. Grants and policy have effective dates; revocation requires a policy edit and restart, which clears browser sessions.

## Demonstrate two actors

1. Sign in as the author and create a report draft from a frozen valuation. Combine analyst/operator roles in the private teaching policy if that actor also funds the book.
2. Open the draft in the governance inbox. Even an author who also has approver permission cannot approve their own revision.
3. Send the same action directly to the API: the server rejects it as well.
4. End that session and sign in as a separate approver. Inspect the exact evidence, write a review reason, acknowledge report gaps and approve.
5. Filter audit by report.approve. The committed event records authenticated actor, resource revision, policy, reason and request correlation. A lost-response replay adds no second approval event.

Rebalance and resolution approvals use the same creator separation and exact-revision check. Existing financial checks still reject stale prices, changed books and invalid workflow transitions. Earlier unauthenticated drafts need newly authored decision evidence.

## Explain overrides and sessions

Price overrides require approver authority. Audit preserves the prior recorded mark or explicit absence, the new mark, source and reason. A manual override does not certify market data.

Tokens are exchanged through an Authorization header for a 30-minute HttpOnly, SameSite Strict session. Browser commands carry CSRF tokens. The server rejects missing CSRF, foreign browser origins, expired sessions and credentials from another workspace. No token goes into localStorage or report exports.

## Recover the book

Write a recovery reason, create a protected backup and select **Verify isolated restore**. Inspect the verified path and cutoff. This is a real restored database with copied raw evidence; it is separate from the live book.

The independent fixture backs up ten shares, 9,000 cash and an approved report. A later 500 deposit changes the live book only. Restoring the checkpoint reproduces the old book and exact issued JSON. Changing a backup byte produces a failed attempt with no replacement path. Follow the [recovery runbook](../runbooks/backup-and-recovery.md) before a manual database switch.

## Code reading order

Contract → access role map → HTTP session hook → command before/after hooks → creator and audit records → SQLite recovery manifest/replay → governance React desk → API and browser adversarial checks.

The frontend loads chapters on demand. Shared chapter styles are loaded at the application root so direct links have the same layout as sequential navigation.

## Recording sequence

Disputed approval → author identity → denied self-approval in UI and direct API → independent reviewer → audit and override lineage → backup cutoff → later live change → verified isolated restore → corrupted backup rejection → complete course recap.

Read the [definition contract](17-definition-contract.md). The core teaching course ends here. Public deployment, identity-provider federation, remote audit attestation, live brokerage and specialist asset rules remain separate extensions.
