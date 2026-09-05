# Certificate Register

Non-transferable certificates for the University of Calcutta, written to Base
Sepolia. An employer pastes a wallet address or the register number printed on
the document, and the record comes back off the chain. Nothing to install, and
nobody at the examinations office to email.

Built for the HackBlox 2026 Web3 track, problem statement 2.

**Contract:** [`0x0b416829227749bF58AA90d66dC6a429273b1DC9`](https://sepolia.basescan.org/address/0x0b416829227749bF58AA90d66dC6a429273b1DC9)
on Base Sepolia, deployed 4 September 2026, source verified.

## How a check actually works

The verification page never touches a wallet. It opens a viem public client
against Base Sepolia, calls `getCertificates(address)` or
`getCertificate(tokenId)` depending on what you typed, and renders whatever
comes back, revoked entries included. Those show struck through with the
revocation still on the record instead of quietly vanishing, because an
employer needs to see that a certificate was withdrawn rather than just fail to
find it.

`/certificate/42` draws the printable document from what the chain says right
now: SVG in the browser, `?format=pdf` for A4 landscape, `?download=1` to get
it as an attachment. Each one carries a QR code back to its verification page.
The copy pinned at mint time can go stale; this one can't.

Issuing is the only part that needs a wallet. A whitelisted address signs
`issueCertificate` and the token lands in the graduate's wallet with no way
back out.

## Running it

Two npm projects: Hardhat at the repo root, the Next app in `frontend/`.

```bash
npm install
npm test
```

```bash
cd frontend && npm install && npm run dev
```

Nine contract tests cover the parts worth breaking. A whitelisted issuer can
mint and a stranger can't, an admin can add an issuer who then mints, transfers
and approvals both revert after minting, revoking flips validity without moving
the token, and nobody can revoke a certificate they didn't issue.

### Environment

Root `.env`, for the Hardhat scripts:

```
BASE_SEPOLIA_RPC_URL=    # falls back to https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=    # throwaway wallet, testnet only
ETHERSCAN_API_KEY=       # for npm run verify
```

`frontend/.env.local`, for the app:

```
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=
NEXT_PUBLIC_SITE_URL=    # optional; otherwise inferred from the request
PINATA_JWT=              # server-side only, never NEXT_PUBLIC_
```

Without `PINATA_JWT` the app still mints, embedding the metadata and artwork as
a base64 data URI instead of pinning them. Handy when Pinata is slow at 3am,
though the token URI is then a lot bigger and it stops satisfying the "metadata
on IPFS" requirement.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run deploy` | Deploys and records the address in `deployments/` |
| `npm run verify` | Publishes source to Basescan |
| `npm run mint` | Mints a certificate from the deployer |
| `npm run read` | Prints every certificate held by `READ_ADDRESS` |
| `npm run grant:issuer` | Whitelists `ISSUER_ADDRESS` as an issuer |
| `npm run check:role` | Reads roles for `CHECK_ADDRESS` |
| `npm run sync:abi` | Regenerates `frontend/lib/contract.ts` |
| `npm run wallet:new` | Generates a fresh throwaway deployer keypair |
| `npm run balance` | Deployer balance and which RPC is in use |

Run `sync:abi` after any redeploy. It writes the address and ABI into the
frontend as one typed module, so the app and the chain can't drift apart.

## Contract notes

`SoulboundCertificate` is an ERC-721 with `AccessControl`, and the soulbound
part is a single override: `_update` reverts whenever the token already has an
owner. That blocks burns as well as transfers, which is deliberate. A
credential shouldn't be destroyable by the person it judges; revocation is the
mechanism, and it leaves a record.

`approve` and `setApprovalForAll` revert outright. Nothing can move, so an
approval is meaningless, and failing loudly stops a marketplace listing a token
that could never settle.

Holder lookups use a plain `mapping(address => uint256[])` rather than
`ERC721Enumerable`, which is cheaper and hands the verification page exactly
the query it needs in one call. The trade-off shows up on Basescan, which reads
`totalSupply()` to fill in its supply field and displays 0; the contract
exposes `totalIssued()` instead.

## Things that went wrong, so you don't repeat them

npm installed TypeScript 7, and `ts-node` 10.9.2 can't read a config under it.
Every Hardhat command died with `Cannot read properties of undefined (reading
'fileExists')`, which looks nothing like a version conflict. `devDependencies`
pins TypeScript to 5.x for that reason. Don't unpin it.

OpenZeppelin 5.6 emits the `mcopy` opcode, so `evmVersion` has to be `cancun`.
Hardhat defaults to `paris` and the contract simply won't compile.

Etherscan's V1 verification endpoints are gone. `hardhat-verify` switches to
the V2 unified API only when `etherscan.apiKey` is a plain string; a
per-network key object with `customChains` takes the V1 path and fails.

The public Base RPC load-balances across nodes, so a read immediately after a
write can hit one that's a block behind. Granting an issuer role and then
checking it returned `false` on a transaction that had already succeeded. The
grant script polls now, and a dedicated RPC endpoint makes the problem go away.

One more, for anyone starting from the problem statement: it suggests Polygon
Mumbai, which shut down in April 2024. Base Sepolia or Polygon Amoy instead.

## What isn't here

Issuer tiers. The contract has an admin who appoints issuers, but an issuer
can't appoint anyone below them. `AccessControl` supports it through
`_setRoleAdmin`, so it's a small change, and it would need a redeploy.
