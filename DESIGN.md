# Design

## Source of truth
- Status: Active. Last refreshed: 2026-11-06.
- Current work boundary (latest): the CEO-directed issuance → customer handoff → third-party verification is the focus. Export the actual PDF plus verification JSON, then import them in the KODA receiver dashboard. Latest user request now authorizes both verification environments: 02 KODA dashboard and 03 external reproducibility draft with specification/code. The re-signed conflict case stays a later auxiliary scenario. Earlier context: the user rejected the seven-chapter version as dense and fragmented. Rebuild the presentation around TWO acts: issuance/registration/customer delivery, then third-party verification. After local review the user requested a link, authorizing publication of this two-act version. The CEO's external-document verification brief remains the content authority. Research informs communication, not new business or proof claims.
- Refinement baseline: the user accepted the architecture-led version as the draft to improve. Primary architecture and narrative labels use Ethereum, the planned document registry chain. Identify Sepolia separately as the actual test execution environment; preserve the real chain ID, RPC, wallet checks and explorer destinations. Never imply that existing test transactions were executed on Ethereum mainnet.
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
- Third party imports the received PDF and verification JSON in the KODA dashboard and verifies without a wallet. Start with empty input; only explicit presenter examples preload files. Only this surface uses product UI.

## Information architecture
- Three navigation scenes: retain the two core acts and add 03 external verification as a separately labeled review draft. Core acts: (1) KODA issues a PDF, registers verification information on Ethereum, and delivers the PDF to the customer; (2) the third party verifies the submitted PDF in a single KODA dashboard. Internal technical phases do not create more pages or numbered chapters.
- The verification dashboard stays in place. Show a visual event beside it: a request travels to Ethereum, the existing registry record is highlighted, the response returns and is compared with the submitted file. A new block must not appear when reading. One evidence-gated visual sequence starts at the verification click. The real result is immediately accessible in a status line if it finishes first; the main verdict follows the visible request, record response and comparison. Explicit replay adds no RPC.
- Put each business actor in the architecture ONCE. Connect KODA and the customer directly to Bitcoin for custody/asset attribution, and connect KODA and the third party directly to Ethereum for registration/query. No separate custody-background box, no third-party path to Bitcoin, no bridge between the two chains.
- The first act gives the context briefly, offers actual PDF/JSON downloads as presenter controls, then opens the receiver dashboard. Do not build a customer product UI. The second act is the core demonstration. Original and altered files are two inputs to the same UI, not additional scenes.
- A compact presentation transport offers play/pause, previous/next and jump to verifier. It is not a pretend KODA product navigation.
- The whole journey is one technical process. KODA, the customer and the third party are business actors; Ethereum is shared infrastructure used for registration AND third-party reads, not a fourth business actor or a customer asset destination.
- Technical stage is an open neutral/mint canvas with explicit inputs, operations, outputs and arrows crossing named boundaries. Only the third party gets a product window. That window remains connected to visible local hashing/signature recovery and public JSON-RPC reads; the last scene is not detached from the technical demonstration.
- Persistent architecture is a compact orientation aid, roughly one quarter of desktop width. It must not compete with the main demonstration. Mobile stacks it without horizontal overflow.
- One heading and one main event per act. Short accurate technology labels support the event; algorithms, full hashes, typed fields, contract rules, RPC methods and finality explanations belong to the appendix/closed evidence. Do not repeat the same explanation in the map, scene title, technical panel and footer.
- KODA is shown issuing the BTC balance certificate in the opening context. Mark existing issuance/delivery as existing business and hash/sign/register/verify as the implemented addition. Demonstration issuer processing actually runs in the browser + MetaMask; production KODA server placement is undecided.

## Design principles
- The demo explains the proposed idea, not every implementation step. Keep the document, the registered comparison basis, the request/response and the result visually continuous. Technical correctness constrains the visuals but does not require every condition to be printed.
- Actor/processing location stays visible, with current actor emphasized.
- Visual continuity: the exact PDF becomes a hash; hash plus ID/time becomes signed typed data; contract checks lead to a transaction/block; the original is then compared with a submitted file.
- Real data and state precede spectacle. Replay is always labeled; playback time is never presented as network execution time.
- Start motion with the verification click, not an automatic rewind after completion. Show a document-ID request from the dashboard button to Ethereum, then a card carrying the observed original hash back into the dashboard comparison slot. Use minimum reading time plus actual trace gates. Pause all motion; offer result skip and explicit replay. Reduced motion shows real results directly. No invented response on errors or pending results.
- Map scope notes distinguish the native BTC being certified on Bitcoin from document verification information recorded on Ethereum. The certificate's balance field is not the asset itself. Use distinct orthogonal registration/query/response paths without implying special meaning in their bends.

## Visual language
- Our tokens, not claimed official Toss values: existing KODA forest green (#006f4c), mint, pale neutral technical canvas, opaque white third-party surface, green action/accent, muted green-grays, restrained red/orange mismatch. User explicitly rejects adopting the Toss blue/black palette. Color is the exception to the requested Toss principles.
- Pretendard; large Korean headings, restrained weights, monospace only for technical values. Full hashes wrap; abbreviations have a full-value details path.
- 8px spacing rhythm, generous stage margins, minimal borders. Rounded surfaces reserved for the verifier and actual controls, not every technical object.
- Causal motion: document scan → digest assembly, signed fields bind to issuer, contract conditions resolve, registration enters a block. Finite animations with pause/replay; no endless decoration.
- Small original SVG icons with consistent 24px viewBox and 2px rounded strokes. No Toss asset copying.

## Components
- Reuse existing wallet, PDF, verification and persistence modules without changing their trust rules. Incoming JSON requires the registration transaction hash and identifies the fixed publicly configured registry. Issuer localStorage cannot expand receiver trust. Handoff downloads require successful block inclusion; verification independently checks finality. A newly deployed registry needs a separate public allowlist update before handoff; it cannot supply a new issuer, contract trust anchor, RPC endpoint or executable code. Receiver proof and PDF state are separate from issuer state, including on a fresh browser visit.
- Focused scene objects, persistent ArchitectureMap, playback transport and third-party verifier. Actual trace IDs drive the map during verification; local receipt decoding and finality comparison must not masquerade as new chain calls.
- Controller owns live data and wallet calls. Presentation owns local replay position, visual transitions and copy.
- Tokens live in presentation CSS; avoid another styling dependency.

## Accessibility
- Target WCAG 2.2 AA basics: readable contrast, semantic buttons/headings, visible focus, labels, 44px touch targets.
- Every player control works by keyboard. Status uses polite live regions; errors use alerts. Color is accompanied by text/icons.
- Reduced motion disables verifier choreography and exposes actual results directly. Changing this preference during or after verification must not restart an old animation or reset a busy run to ready.

## Responsive behavior
- Desktop presentation first (1280–1920), with functional 390px mobile layout.
- Scenes reflow vertically on narrow screens; no clipped long hashes or horizontal page overflow. Verifier becomes one column.
- No hover-only essential information.

## Interaction states
- Loading names the real operation; no fabricated percentage/completion.
- Empty state explains missing registered evidence and offers presenter tools.
- Pending inclusion/finality is not a failed or verified result. RPC unavailable offers retry and never turns green.
- Success means the submitted PDF matches a signed registered hash. Mismatch means different bytes, not necessarily fraud or a particular changed field.
- Dashboard results lead with large icon + explicit match/mismatch/incomplete/pending text and the CEO's three questions. A valid signature on the original metadata does not authenticate an altered submitted PDF: that first question requires the submitted file to match the trusted registered original.
- Disabled issuer actions explain wallet/setup requirements. Read-only verification does not require connection or payment.

## Content voice
- Use concise Korean subject/action/result copy. On stage, retain only relevant short technical labels such as SHA-256, 발급서명, 스마트컨트랙트, Ethereum 기록 조회. Put EIP-712 fields, secp256k1, raw function parameters and full RPC sequence in the appendix. Do not substitute vague marketing metaphors for the actual mechanism.
- Technical labels stay accurate: SHA-256, EIP-712 / ECDSA secp256k1, Solidity / EVM, JSON-RPC / eth_call / finalized.
- Network wording: primary map/block labels say Ethereum; an execution note says Sepolia testnet. Real block numbers and explorer links are test execution evidence. The signed domain remains chainId 11155111 and is shown accurately in technical details.
- Separate why a public blockchain is used from why Ethereum L1 was selected. The former is external access to the registered comparison basis; the latter is the chosen public-L1/EVM design for issuer authorization, first-registration preservation, and fixed-state reads. Do not claim these are unique to Ethereum or establish optimal operating cost.
- Three checks: issued by the configured issuer; matches issuance original; no difference relative to that original. Test issuer ≠ official KODA identity. Do not imply all intermediate edits or current validity are proven.
- New fictional customer: 인하테크홀딩스㈜. The already registered historical PDF remains 한울테크홀딩스㈜; changing it would change its hash.

## Implementation constraints
- Existing React/Vite/TypeScript/CSS and viem; no new dependency needed. CSS keyframes/transitions are sufficient for the current scene vocabulary.
- Recorded replay is explicitly labeled and only displays fields actually present in preserved evidence. New issuance uses real callbacks; no wallet requests on page load or replay.
- Demo balance/as-of and issuance time remain separate. PDF contents/customer/BTC amount stay off-chain; transaction calldata includes signature plus ID/hash/issuedAt.
- Verify public chain live on click; show receipt inclusion and current finalized height separately. No automatic finality assertion based on elapsed time.
- Validate tests/typecheck/build, desktop/mobile browser views, original and altered files, keyboard and reduced-motion behavior.

## Open questions
- Sharing route remains `/sepolia-20261106/`. The user subsequently requested a link to the locally reviewed two-act version; publish the verified build at this route and check the public version.
- [ ] User wallet approval for a new 인하테크홀딩스㈜ certificate; collect for next session, do not prompt during overnight work.
- [ ] Production issuer identity governance, key rotation/revocation and chosen RPC trust policy remain future decisions, not implemented claims.
- [ ] External verifier/code distribution is now authorized as a review prototype (03). Both paths use the same hash, signature, registry and trust criteria; identity onboarding, access rights and production RPC policy remain unconfirmed. PDF/JSON format is our technical design rather than a CEO-prescribed file format.

## 2026-11-06 · 두 검증 환경과 기술 부록
- 02 preserves the accepted live request/response/compare flow inside a more recognizable KODA shell. Actual reference: `기업 프로젝트/미팅/10.16 KODA 오피스 방문/금요일 미팅 아이디어와 질문 만들기/assets/현재화면.png`. White fixed navigation, organization header, pale main background and green active navigation are observed; the proposed evidence verification feature is ours.
- Do not grant a fictional external recipient access to customer balances or internal approvals. Product chrome can suggest the KODA family without pretending unconfirmed authorization exists. The external access arrangement is a KODA feedback question.
- 03 demonstrates a separate execution environment using published rules/code plus the same PDF/JSON and independently pinned trust anchor. Clearly distinguish saved observed CLI runs from live browser verification. Do not invent a terminal execution or call this an independent code audit.
- Keep the map label `제3자`; explain banks, counterparties and external auditors once outside the tiny box. Map surface label follows dashboard versus external execution.
- Technical appendix uses the light-gray, dark-navy, green/mint architecture style, one main technology per page, editable text/diagrams, and concrete implementation plus limitation. SHA-256, EIP-712/ECDSA secp256k1, Solidity/EVM and finalized RPC rules do not change.
- No new wallet, deploy or registration action in this iteration. Discuss using preserved real transaction receipts for pitching; live wallet/finality remains a rehearsal option, not required on stage.

## 2026-11-06 · 조회 코드와 실제 등록 근거
- The latest request authorizes another certificate registration in the existing Sepolia registry, using the user's wallet approval. It does not authorize or require a fresh deployment. Preserve the previously registered historical PDF and evidence.
- Keep the accepted delivery/query choreography and third-party dashboard. Place persistent short labels on the actual request/response paths, local processing and registry record. Remove the changing code/explanation card. Exact code remains in the technical appendix; actual execution logs remain in technical details.
- Labels remain after completion; only emphasis and observed data change. Distinguish current computation, completed computation being shown, and replay. Wallet connection or another busy presenter operation must not start verification visuals.
- Local verification and read-only calls need no recipient wallet or transaction fee. Off-chain document signing needs the issuer key but no on-chain gas. Registration changes contract state and its transaction sender pays gas in the current direct-send implementation. Production key custody and RPC billing remain separate decisions.
- Keep detailed code, RPC semantics, fee equations, references and limitations in the technical appendix. The main map remains Ethereum; test execution evidence retains Sepolia and chainId 11155111.
- Audience comprehension comes from spatially persistent `RPC 조회`, `등록 기록 응답`, browser hash/signature processing and smart-contract record labels. Preserve the previous 6.9-second minimum motion timing; real network waits may extend it. Pause, skip-to-result, replay and reduced motion remain available. Do not solve information overload simply by slowing a text carousel.
- In 01, SHA-256/EIP-712 stays beside the PDF-derived proof, issuer authorization and no-overwrite rules stay beside Ethereum, and observed receipt inclusion remains distinct from finality. Do not reuse the receiver's potentially unrelated proof result as issuer finality evidence.
