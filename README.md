# Certificate Register

Non-transferable certificates for the University of Calcutta, written to Base
Sepolia. An employer pastes a wallet address or the register number printed on
the document, and the record comes back off the chain. Nothing to install, and
nobody at the examinations office to email.

Built for the HackBlox 2026 Web3 track, problem statement 2.

**Contract:** [`0xC7594b300e81a7C03b2E6C3f76B1E5718c73f746`](https://sepolia.basescan.org/address/0xC7594b300e81a7C03b2E6C3f76B1E5718c73f746)
on Base Sepolia, deployed 5 September 2026, source verified. The first
deployment at `0x0b41…1dC9` is still up and still readable; it predates the
issuer hierarchy, and nothing migrates between the two.

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
`issueCertificateAt` and the token lands in the graduate's wallet with no way
back out.

### Who can sign what

Three tiers, wired through `_setRoleAdmin` so AccessControl enforces them on
the raw `grantRole` path as well as through the named functions. The admin
appoints registrars, a registrar appoints the issuers under it, and an issuer
mints. Nobody appoints sideways: an issuer can't create another issuer, and a
registrar can't create another registrar.

`appointedBy` records which registrar hired which issuer, and two rules hang
off it. A registrar can strip only the issuers it appointed, and it can revoke
certificates those issuers minted; an admin can do either to anyone. A
faculty can therefore clean up after its own department without being handed
the keys to the whole register.

### The register number is a condition, not a guess

The artwork is drawn and pinned before anything is signed, so it has to be
stamped with a number the mint hasn't produced yet. Reading `nextTokenId()`
and hoping is fine until two issuers read the same value in the same block,
at which point one of them ends up holding a certificate whose printed number
belongs to somebody else.

`issueCertificateAt` takes that number as an argument and reverts with
`RegisterEntryTaken(nextTokenId)` unless the chain still agrees. The mint
either matches the paper or doesn't happen. The revert carries the real number,
so the dashboard rebuilds the artwork against it and asks for one more
signature rather than starting over. Scripts that don't care still use plain
`issueCertificate`.

## Running it

Two npm projects: Hardhat at the repo root, the Next app in `frontend/`.

```bash
npm install
npm test
```

```bash
cd frontend && npm install && npm run dev
```

Sixteen contract tests cover the parts worth breaking. A whitelisted issuer can
mint and a stranger can't, transfers and approvals both revert after minting,
revoking flips validity without moving the token, and nobody can revoke a
certificate they didn't issue. The rest sit on the two things that took the
most thought: the appointment chain, including the sideways moves it has to
refuse, and a second issuer taking the register number out from under a mint
that's already been prepared.

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
| `npm run grant:registrar` | Admin appoints `REGISTRAR_ADDRESS` as a registrar |
| `npm run grant:issuer` | Registrar appoints `ISSUER_ADDRESS` as an issuer |
| `npm run check:role` | All three tiers for `CHECK_ADDRESS`, and who appointed it |
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
## What isn't here

A screen for any of the appointment work. The hierarchy exists on-chain and the
scripts drive it, but the dashboard at `/issue` only mints and revokes, so
adding a registrar means running `grant:registrar` from a terminal. Nothing in
the contract stands in the way of a proper admin page; nobody has built one.

The registrar's view of revocation, for the same reason. A registrar can revoke
what its issuers minted, and the contract will let it, but `IssuedList` filters
the register down to certificates the connected wallet issued itself. So the
button is there for your own entries and missing for the ones you supervise.
