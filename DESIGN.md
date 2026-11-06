# Design

## Source of truth
- Status: Active. Last refreshed: 2026-11-06.
- Surface: `/live.html`, the BTC document verification presentation and working Sepolia verifier.
- Latest user correction (2026-11-06, after first publication): the dense technical version is tiring and loses the point. Keep the overall architecture visible beside a focused scene, activate the current actor/location/data path, and make the blockchain's role and added value visible through operations. Technical names and long hashes alone do not explain the system.
- Authority: user's latest directions, the revised 윤다현 proposal, CEO/COO scope. Older USDC demos are not functional or visual authority.
- Evidence: `apps/web/src/live`, actual receipts under `docs/portfolio/2026-11-06-sepolia`, local Pretendard/OFL, local DFY Typography/Icon/Grid and PlusX Interaction `.fig` thumbnails. Thumbnails only establish layout/type/icon/motion reference availability; they do not justify claiming the full course was studied.
- Official references: [Toss writing principles](https://toss.tech/article/8-writing-principles-of-toss), [one message per page](https://toss.tech/article/design-motivation), [interaction communicates feedback and process](https://toss.tech/article/interaction), [error writing](https://toss.tech/article/how-to-write-error-message), [progress stepper](https://tossmini-docs.toss.im/tds-mobile/components/progress-stepper/). This is our application of published principles, not an official Toss UI or endorsement. No private Toss assets or course files are distributed.

## Brand
- Calm, exact, approachable. Large clear Korean typography, generous empty space, restrained color and meaningful motion.
- Trust comes from real hashes, recoverable signatures, receipts, explorer links and honest pending/error states.
- Avoid decorative dashboards, repeated generic rounded cards, emoji icons, neon/glow, fake counters, missing technical detail, or implied official KODA issuer certification.

## Product goals
- Make clear where each operation happens, which technology performs it, and what the third party can verify.
- Core functions: verification against issuance information; registration/query of that information. Existing KODA issuance is context, not invented new business.
- Success: viewers distinguish native BTC from Ethereum document records, understand three checks and see original/altered PDF results from real RPC reads.
- Non-goals: prove actual BTC reserves, invent business rules or KODA production integration, transfer BTC, deploy again without the user's wallet approval.

## Personas and jobs
- Presenter explains the technical sequence; issuer controls belong in a collapsible presenter area.
- Customer keeps and submits its PDF; do not invent a separate customer app.
- Third party selects a PDF and verifies without a wallet. Only this surface uses product UI.

## Information architecture
- One presentation route: introductory scene → original → hash → signature → contract → block inclusion/finality → customer handoff → verifier.
- A compact presentation transport offers play/pause, previous/next and jump to verifier. It is not a pretend KODA product navigation.
- The whole journey is one technical process. KODA, the customer and the third party are business actors; Ethereum is shared infrastructure used for registration AND third-party reads, not a fourth business actor or a customer asset destination.
- Technical stage is an open neutral/mint canvas with explicit inputs, operations, outputs and arrows crossing named boundaries. Only the third party gets a product window. That window remains connected to visible local hashing/signature recovery and public JSON-RPC reads; the last scene is not detached from the technical demonstration.
- Persistent architecture occupies roughly one third of desktop width. The other two thirds show the current operation. The map remains spatially stable across every scene, including the third-party UI. Mobile stacks the map and scene without horizontal overflow.
- The first visual level is actor/location plus input → operation → output. The second level names the actual algorithm, contract action and observed result. Complete hashes, typed data, signatures and detailed traces remain available in that scene's expandable evidence; do not give every byte the same visual weight.
- KODA is shown issuing the BTC balance certificate in the opening context. Mark existing issuance/delivery as existing business and hash/sign/register/verify as the implemented addition. Demonstration issuer processing actually runs in the browser + MetaMask; production KODA server placement is undecided.

## Design principles
- One coherent operation per scene with a short purpose-led heading, visible technical mechanism and actual data dependencies. Reduce repeated prose and raw payload density, not the technical process.
- Actor/processing location stays visible, with current actor emphasized.
- Visual continuity: the exact PDF becomes a hash; hash plus ID/time becomes signed typed data; contract checks lead to a transaction/block; the original is then compared with a submitted file.
- Real data and state precede spectacle. Replay is always labeled; playback time is never presented as network execution time.

## Visual language
- Our tokens, not claimed official Toss values: existing KODA forest green (#006f4c), mint, pale neutral technical canvas, opaque white third-party surface, green action/accent, muted green-grays, restrained red/orange mismatch. User explicitly rejects adopting the Toss blue/black palette. Color is the exception to the requested Toss principles.
- Pretendard; large Korean headings, restrained weights, monospace only for technical values. Full hashes wrap; abbreviations have a full-value details path.
- 8px spacing rhythm, generous stage margins, minimal borders. Rounded surfaces reserved for the verifier and actual controls, not every technical object.
- Causal motion: document scan → digest assembly, signed fields bind to issuer, contract conditions resolve, registration enters a block. Finite animations with pause/replay; no endless decoration.
- Small original SVG icons with consistent 24px viewBox and 2px rounded strokes. No Toss asset copying.

## Components
- Reuse existing wallet, PDF, verification and persistence modules without changing their trust rules.
- Focused scene objects, persistent ArchitectureMap, playback transport and third-party verifier. Actual trace IDs drive the map during verification; local receipt decoding and finality comparison must not masquerade as new chain calls.
- Controller owns live data and wallet calls. Presentation owns local replay position, visual transitions and copy.
- Tokens live in presentation CSS; avoid another styling dependency.

## Accessibility
- Target WCAG 2.2 AA basics: readable contrast, semantic buttons/headings, visible focus, labels, 44px touch targets.
- Every player control works by keyboard. Status uses polite live regions; errors use alerts. Color is accompanied by text/icons.
- Reduced motion disables auto-advance and decorative movement; manual navigation and all results remain available.

## Responsive behavior
- Desktop presentation first (1280–1920), with functional 390px mobile layout.
- Scenes reflow vertically on narrow screens; no clipped long hashes or horizontal page overflow. Verifier becomes one column.
- No hover-only essential information.

## Interaction states
- Loading names the real operation; no fabricated percentage/completion.
- Empty state explains missing registered evidence and offers presenter tools.
- Pending inclusion/finality is not a failed or verified result. RPC unavailable offers retry and never turns green.
- Success means the submitted PDF matches a signed registered hash. Mismatch means different bytes, not necessarily fraud or a particular changed field.
- Disabled issuer actions explain wallet/setup requirements. Read-only verification does not require connection or payment.

## Content voice
- Use concise accurate Korean labels for responsibility and purpose; retain precise technical language for computation and implementation. Prefer “SHA-256 해시 계산”, “EIP-712 구조화 데이터 서명”, “register(...)”, “eth_call”, “ECDSA 서명자 복구” over replacing these with only metaphors such as “문서 지문”.
- Technical labels stay accurate: SHA-256, EIP-712 / ECDSA secp256k1, Solidity / EVM, JSON-RPC / eth_call / finalized.
- Three checks: issued by the configured issuer; matches issuance original; no difference relative to that original. Test issuer ≠ official KODA identity. Do not imply all intermediate edits or current validity are proven.
- New fictional customer: 인하테크홀딩스㈜. The already registered historical PDF remains 한울테크홀딩스㈜; changing it would change its hash.

## Implementation constraints
- Existing React/Vite/TypeScript/CSS and viem; no new dependency needed. CSS keyframes/transitions are sufficient for the current scene vocabulary.
- Recorded replay is explicitly labeled and only displays fields actually present in preserved evidence. New issuance uses real callbacks; no wallet requests on page load or replay.
- Demo balance/as-of and issuance time remain separate. PDF contents/customer/BTC amount stay off-chain; transaction calldata includes signature plus ID/hash/issuedAt.
- Verify public chain live on click; show receipt inclusion and current finalized height separately. No automatic finality assertion based on elapsed time.
- Validate tests/typecheck/build, desktop/mobile browser views, original and altered files, keyboard and reduced-motion behavior.

## Open questions
- Sharing route: `/sepolia-20261106/`. The user requested publishing the verified architecture-led iteration at this route for team feedback; the earlier snapshot remains in Git history.
- [ ] User wallet approval for a new 인하테크홀딩스㈜ certificate; collect for next session, do not prompt during overnight work.
- [ ] Production issuer identity governance, key rotation/revocation and chosen RPC trust policy remain future decisions, not implemented claims.
- [ ] External verifier distribution/JSON handoff remains deferred as requested. Internal proof data is still needed by the demo.
