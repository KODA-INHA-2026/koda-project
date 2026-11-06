export const sourceCommit = '1e1eaadc20252754ad54ff5723c30b4bf4c2e43d';
const repo = `https://github.com/KODA-INHA-2026/koda-project/blob/${sourceCommit}/`;
export const demoStages = [
  ['01 원본 발급', 'KODA의 가상 수탁정보로 PDF를 생성한다. 잔고 기준시점과 발급 기재시각을 구분한다.'],
  ['02 전자서명·해시 생성', 'PDF 전체 바이트의 SHA-256을 계산하고, 문서 ID·해시·발급시각을 EIP-712 메시지로 서명한다.'],
  ['03 블록체인 기록', 'DocumentRegistry에 검증정보를 등록한다. 고객사는 PDF와 검증정보 JSON을 받아 보관·제출한다.'],
  ['04 제3자 대조·검증', 'KODA 대시보드 적용안에서 제출 PDF·서명을 확인하고, Ethereum에 등록된 기준을 RPC로 조회해 대조한다.'],
  ['05 외부 검증 초안', '04와 다른 실행 환경을 보여주는 대안이다. 화면은 보존된 Node.js 실행 결과이며, 내려받은 도구를 실행하면 새 RPC 조회를 수행한다.'],
];
export const slideScenes = [
  '데모 01–04 본 흐름 · 05 외부 검증 초안',
  '데모 01–03 데이터 생성·저장 · 04·05 제출 자료 대조',
  '데모 02 발급 원본 해시 생성 · 04·05 제출 PDF 해시 재계산',
  '데모 02 EIP-712 서명 · 03 등록 시 확인 · 04·05 수신 검증',
  '데모 02 발급자 서명 · 03 계약의 주소 복구 · 04·05 수신 검증',
  '데모 03 register 상태 변경 · 04·05 records 조회',
  '데모 03 최초 등록 규칙 · 04·05 저장값 대조',
  '데모 03 등록 증거 생성 · 04·05 거래·영수증·이벤트 확인',
  '데모 03 블록 포함 · 04·05 finalized 기준 대조',
  '데모 04 브라우저 RPC 조회 · 05 별도 Node.js 실행',
  '데모 03 PDF·JSON 전달 · 04·05 수신 파일 파싱',
  '사전 배포·신뢰 설정 · 데모 03 등록 전 확인 · 04·05 검증 전 확인',
  '데모 04 재서명 비교 · 05 일반 검증 패키지에는 미포함',
  '데모 04 대시보드 검증 · 05 외부 검증 초안 (대안 경로)',
  '데모 02 Wallet 서명 · 03 Wallet 등록 · 04·05 Public 조회',
  '데모 02 오프체인 서명 · 03 거래 수수료 · 04·05 RPC 비용',
  '데모 03 인하테크홀딩스 실제 등록 · 04 검증에 쓰는 거래',
  '데모 03 등록 거래 탐색 · 04·05 PDF와 등록 기록 대조',
];
export const references = {
  registration: ["Sepolia Etherscan · 문서 등록 거래","https://sepolia.etherscan.io/tx/0xb75fdf3acb19b955e451e86cb3c27c2d18f3ed3079f33624a3be71afd16310eb"],
  contractExplorer: ["Sepolia Etherscan · 계약 주소","https://sepolia.etherscan.io/address/0xC13083047C0657FF576A972469d982b51E43dCB3"],
  sha: ['NIST FIPS 180-4, §§4.1.2, 5, 6.2', 'https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf'],
  eip: ['EIP-712, Specification / Security Considerations', 'https://eips.ethereum.org/EIPS/eip-712'],
  ec1: ['Standards for Efficient Cryptography 1, v2, §4.1', 'https://www.secg.org/sec1-v2.pdf'],
  ec2: ['Standards for Efficient Cryptography 2, v2, §2.4.1', 'https://www.secg.org/sec2-v2.pdf'],
  oz: ['OpenZeppelin Contracts 5.x, ECDSA / EIP712', 'https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography'],
  abi: ['Solidity 0.8.28, Contract ABI Specification', 'https://docs.soliditylang.org/en/v0.8.28/abi-spec.html'],
  storage: ['Solidity 0.8.28, Mappings and Dynamic Arrays', 'https://docs.soliditylang.org/en/v0.8.28/internals/layout_in_storage.html'],
  rpc: ['Ethereum, JSON-RPC API', 'https://ethereum.org/developers/docs/apis/json-rpc/'],
  pos: ['Ethereum, Proof-of-stake / Finality', 'https://ethereum.org/developers/docs/consensus-mechanisms/pos/'],
  viemPublic: ['viem 2.x, Public Client / readContract', 'https://viem.sh/docs/clients/public'],
  viemWallet: ['viem 2.x, Wallet Client / signTypedData', 'https://viem.sh/docs/clients/wallet'],
  gas: ['Ethereum, Gas and fees', 'https://ethereum.org/developers/docs/gas/'],
};

export const slides = [
  {
    title: "기술 부록 · 구현 명세와 검증 근거",
    subtitle: "기술 검토용 참고자료. 표준의 보장, 현재 코드의 동작, 미구현 운영 요건을 분리한다.",
    leftTitle: "검토 기준",
    left: "기준 소스: 1e1eaad (2026-11-07)\n\nPDF 해시: SHA-256 / Web Crypto\n문서 서명: EIP-712 + ECDSA / secp256k1\n등록 계약: DocumentRegistry / EVM\n컴파일러: Solidity 0.8.28 · optimizer 200 · Cancun\n라이브러리: OpenZeppelin 5.6.1 · viem 2.57.14\n실제 배포·조회: Sepolia, chainId 11155111\n\n04·05 기본 자료: 인하테크홀딩스㈜ 가상 증명서\n04 재서명 비교: 실제 메시지 서명 사용, 새 등록 없음",
    rightTitle: "검증 명제",
    right: "제출 PDF의 전체 바이트가\n신뢰 기준에 지정한 발급자가\n서명·등록한 원본과 일치하는가?\n\n체인 기록은 KODA 내부 DB와\n분리된 대조 기준이다.\n\nBTC 실재·법인 신원·RPC 응답의\n정당성은 별도의 신뢰 전제다.",
    limit: "기획은 Ethereum 기반이다. 실증은 Sepolia에서 수행했다. KODA 상용 시스템 연동·공식 발급자 인증·Mainnet 운영을 구현했다는 의미는 없다.",
    refs: ["eip","rpc"],
    code: "package.json; packages/chain/contracts/DocumentRegistry.sol",
    paths: ["package.json","packages/chain/contracts/DocumentRegistry.sol","apps/web/src/live/verification.ts","apps/web/src/live/signed-comparison.ts"],
  },  {
    title: '데이터 모델 · 자산과 증빙 기록의 분리',
    subtitle: '자산 보관 체인과 문서 검증 체인은 다른 역할이다. BTC 이동·브리지·래핑은 수행하지 않는다.',
    leftTitle: '데이터와 저장 위치',
    left: 'PDF 원문 / 오프체인\n  법인명 · BTC 수량 · 잔고 기준시점 · 발급 기재시각\n  PDF 전체 바이트 M\n\n서명 메시지 / 오프체인\n  D = { documentId: bytes32, documentHash: bytes32,\n        issuedAt: uint64 }\n\nEthereum 계약 저장값\n  records[documentId] = { documentHash, issuedAt }\n  authorizedIssuer: immutable address\n\nBTC 잔고·고객명은 해시로 간접 결속된다.',
    rightTitle: '값의 의미',
    right: '잔고 기준시점\n증명서가 설명하는 잔고의 시점.\nPDF에만 기재한다.\n\nissuedAt\n발급자가 입력하고 서명한 초 단위 값.\n계약은 양수만 검사한다.\n\n등록 블록 timestamp\n체인에 포함된 블록의 시각.\n위 두 시각의 진실성을 보증하지 않는다.',
    limit: '현재 원천 데이터는 가상값이다. 실제 수탁 원장·Bitcoin UTXO·잔고 증명과 연결돼 있지 않다. 공개 해시는 암호화나 익명성 보장도 아니다.',
    refs: ['eip','storage'], code:'certificate.ts; DocumentRegistry.sol:9–21,38–61',
    paths:['apps/web/src/live/certificate.ts','packages/chain/contracts/DocumentRegistry.sol'],
  },
  {
    title:'SHA-256 · PDF 바이트의 다이제스트',
    subtitle:'256-bit 출력, 512-bit 메시지 블록, 32-bit 워드 연산과 64라운드 압축 함수를 사용하는 해시다.',
    leftTitle:'계산 정의', mono:true,
    left:'H_file = SHA256(M)\nM = PDF file bytes (no text extraction)\n\nPadding: M || 1 || 0^k || len64(M)\n(len(M) + 1 + k) mod 512 = 448\n\nW[t] = sigma1(W[t-2]) + W[t-7]\n     + sigma0(W[t-15]) + W[t-16]\nT1 = h + Sigma1(e) + Ch(e,f,g) + K[t] + W[t]\nT2 = Sigma0(a) + Maj(a,b,c)\n32-bit additions are modulo 2^32.\n\nOutput: 32 bytes = 64 hexadecimal characters',
    rightTitle:'현재 적용',
    right:'crypto.subtle.digest("SHA-256", bytes)\n\n발급 원본과 수신 PDF에\n동일한 함수를 적용한다.\n텍스트 추출·PDF 정규화는 없다.\n\n보기에는 같은 PDF도 메타데이터나\n인코딩 바이트가 다르면 불일치한다.\n\nPDF 제한: 10 MiB\n헤더 검사: %PDF-',
    limit:'해시 일치는 충돌 저항성을 전제로 바이트 동일성을 판단하는 근거다. 중간 변경·복원 이력 전체나 PDF에 적힌 잔고의 사실성을 증명하지 않는다.',
    refs:['sha'], code:'apps/web/src/live/verification.ts:141–170; verification-file.ts:60–76',
    paths:['apps/web/src/live/verification.ts#L141','apps/web/src/live/verification-file.ts#L60'],
    notes:'FIPS 180-4에서 Ch, Maj, Σ0, Σ1, σ0, σ1을 정의한다. 위 W[t] 식은 t=16..63에 적용한다. 함수 표기를 줄인 것은 알고리즘을 변경한 의미가 아니다. PDF 정규화를 하지 않으므로 detached signature와 원본 전체 바이트를 함께 보존해야 한다.',
  },
  {
    title:'EIP-712 · 타입 해시와 도메인 분리',
    subtitle:'PDF의 SHA-256 값과 별도로, 서명용 구조체·도메인에는 Keccak-256을 적용한다.',
    leftTitle:'실제 서명 페이로드', mono:true,
    left:'T = "Document(bytes32 documentId," +\n    "bytes32 documentHash,uint64 issuedAt)"\ntypeHash = keccak256(T)\nstructHash = keccak256(abi.encode(\n  typeHash, documentId, documentHash, issuedAt))\ndigest = keccak256(0x1901 || domainSeparator\n                  || structHash)\n\nDomain:\n  name: "KodaDocumentRegistryDemo"\n  version: "1"\n  chainId: 11155111\n  verifyingContract: trusted.contract',
    rightTitle:'검증 조건과 범위',
    right:'서명 대상은 documentId,\ndocumentHash, issuedAt이다.\n\n고객명·수량은 직접 필드가 아니라\nPDF 해시를 통해 결속된다.\n\n체인·계약이 달라지면\n서명 다이제스트도 달라진다.\n\nID 중복 거절은 EIP-712이 아닌\nDocumentRegistry의 저장 규칙이다.',
    limit:'EIP-712 자체에는 재전송 방지가 없다. 도메인 분리와 동일 ID 재등록 거절을 구분해야 한다. 발급자의 EOA 키가 유출되면 유효한 새 서명이 만들어질 수 있다.',
    refs:['eip','oz'], code:'packages/chain/src/document-registry.ts:21–27,56–63; DocumentRegistry.sol:48–52',
    paths:['packages/chain/src/document-registry.ts','packages/chain/contracts/DocumentRegistry.sol#L48'],
  },
  {
    title:'ECDSA / secp256k1 · 서명자 주소 복구',
    subtitle:'유효한 서명은 지정된 키와 메시지의 관계를 증명한다. 주소와 법인 신원의 관계는 별도 신뢰 설정이다.',
    leftTitle:'서명 수식과 인코딩', mono:true,
    left:'Curve: y^2 = x^3 + 7 (mod p)\np = 2^256 - 2^32 - 977\nQ = dG  (private key d, public key Q)\n\nz = EIP-712 digest interpreted as an integer\nR = kG\nr = x(R) mod n\ns = k^(-1) * (z + r*d) mod n\n\nsignature = r[32] || s[32] || v[1]\nOpenZeppelin: low-s and v in {27,28}\naddress = last20(keccak256(Q_x || Q_y))',
    rightTitle:'발급·등록·검증',
    right:'MetaMask가 메시지 서명을 수행한다.\n개인키는 앱에 전달하지 않는다.\n\n계약: ECDSA.recover(digest, signature)\n복구 주소 = msg.sender\nmsg.sender = authorizedIssuer\n\n수신자: recoverTypedDataAddress()\n복구 주소 = 사전 지정 발급자\n\n현재 발급자는 EOA다.',
    limit:'k의 재사용·노출은 개인키 노출로 이어질 수 있다. 앱은 암호 구현을 직접 작성하지 않는다. ERC-1271 계약 지갑, 키 교체·폐기·복구 정책은 현재 범위 밖이다.',
    refs:['ec1','ec2','oz'], code:'DocumentRegistry.sol:45–53; verification.ts:217–235; wallet.ts:89–92',
    paths:['packages/chain/contracts/DocumentRegistry.sol','apps/web/src/live/verification.ts#L217','apps/web/src/live/wallet.ts#L89'],
    notes:'n은 secp256k1 생성점 G의 차수이다. z는 이 프로젝트의 Keccak-256 EIP-712 digest이고, PDF 해시를 ECDSA에 곧바로 넣는 구현이 아니다. 서명 정규성 검사는 온체인 OpenZeppelin 경로를 기준으로 설명한다. 제3자 JS 복구가 같은 low-s 정책을 독립적으로 강제한다고 주장하지 않는다.',
  },
  {
    title:'EVM 호출 · ABI 인코딩과 실행 경계',
    subtitle:'Solidity 소스는 바이트코드로 컴파일된다. ABI는 호출 데이터를 인코딩·디코딩하는 규약이다.',
    leftTitle:'현재 계약의 호출 데이터', mono:true,
    left:'register(bytes32,bytes32,uint64,bytes)\nselector = 0xf0c9379a\n\ncalldata = selector || ABI(arguments)\nhead: documentId | documentHash | issuedAt | 0x80\ntail: signature.length | signature | padding\n65-byte signature: 4 + 128 + 32 + 96 = 260 bytes\n\nrecords(bytes32) selector = 0x01e64725\ninput: selector || documentId\noutput: bytes32 documentHash, uint64 issuedAt\nreturn ABI length: 64 bytes',
    rightTitle:'상태 변경과 조회',
    right:'register 거래\nEVM 실행이 성공하면 상태 저장과\n로그 발생. 발신자가 가스를 지불한다.\n\nrecords 조회\neth_call로 지정 블록 상태에서 실행.\n새 거래·서명·온체인 가스 납부 없음.\n\n컴파일: 0.8.28, optimizer 200\nEVM target: Cancun',
    limit:'read-only eth_call도 노드에서 실행 자원을 사용하며 RPC 요금·한도가 있을 수 있다. uint64는 ABI에서 32바이트로 인코딩되며 저장공간의 자료형 크기와 다르다.',
    refs:['abi','rpc'], code:'generated/DocumentRegistry.json; document-registry.ts ABI; wallet.ts:94–99',
    paths:['apps/web/src/live/generated/DocumentRegistry.json','packages/chain/src/document-registry.ts','apps/web/src/live/wallet.ts#L94'],
    notes:'위 selector 및 calldata 길이는 현재 소스의 함수 시그니처와 65바이트 서명을 기준으로 계산한 값이다. calldata의 dynamic offset 0x80은 selector 이후 인수 블록의 시작 기준이다.',
  },
  {
    title:'DocumentRegistry · 저장 구조와 불변조건',
    subtitle:'문서 ID마다 최초 등록한 해시와 발급 기재시각을 저장한다. 발급자 주소는 배포 시 고정한다.',
    leftTitle:'실제 상태·슬롯·불변조건', mono:true,
    left:'mapping(bytes32 => DocumentRecord) public records;\nstruct DocumentRecord {\n  bytes32 documentHash;\n  uint64 issuedAt;\n}\nCompiler storage layout: records slot p = 2\nq = keccak256(abi.encode(documentId, uint256(2)))\nslot q: documentHash; slot q+1: issuedAt (low 8 bytes)\n\nregister requires:\n sender = issuer = recovered signer\n ID != 0; hash != 0; issuedAt > 0\n records[ID].documentHash == 0',
    rightTitle:'이 계약이 강제하는 것',
    right:'같은 ID 재등록은 AlreadyRegistered.\n갱신·삭제·발급자 교체 함수가 없다.\n프록시 업그레이드 구조도 없다.\n\n문서 ID는 저장 위치를 찾는 키다.\n해시·발급시각을 반환한다.\n\n과거 기록의 덮어쓰기 금지와\n기록 내용의 진실성은 별개다.\n최초 입력 오류를 수정할 경로는 없다.',
    limit:'불변조건은 이 컨트랙트의 코드와 고정 신뢰 주소에 적용된다. 다른 주소에 새 계약을 배포하는 일까지 막지 않는다. 정정·폐기·키 교체는 운영 설계가 필요하다.',
    refs:['storage','abi'], code:'DocumentRegistry.sol:9–61; generated/DocumentRegistry.json:storageLayout',
    paths:['packages/chain/contracts/DocumentRegistry.sol','apps/web/src/live/generated/DocumentRegistry.json'],
    notes:'records slot 2는 현재 컴파일 산출물의 실제 storageLayout 값이다. 상속된 OpenZeppelin EIP712의 fallback 문자열 슬롯 0,1 다음에 배치된다. immutable authorizedIssuer는 일반 storage 슬롯에 저장되는 변수가 아니다.',
  },
  {
    title: "등록 증거 · 거래 입력, 영수증, 이벤트, 상태",
    subtitle: "거래 해시 하나로 성공을 판단하지 않는다. 제출 자료와 연결되는 등록 실행인지 여러 증거를 대조한다.",
    leftTitle: "현재 검증 순서",
    left: "1. getTransaction(txHash)\n   to = trusted.contract, from = trusted.issuer\n   register 인수의 ID·해시·issuedAt·서명 일치\n2. getTransactionReceipt(txHash)\n   status = success, from/to 일치\n3. getBlock(receipt.blockNumber)\n   block.hash = receipt.blockHash\n4. DocumentRegistered 이벤트 디코딩\n   계약 주소·ID·해시·issuedAt 일치\n5. 등록 높이 ≤ 조회한 finalized 높이\n6. finalized 높이에서 issuer / records 조회",
    rightTitle: "인하테크홀딩스 등록 관측값",
    right: "인하테크홀딩스㈜ · 가상 100 BTC\n등록 블록: 12,076,051\n블록 시각: 11월 6일 19:44:00 KST\n거래: 0xb75fdf3a…16310eb\n\nPDF 전체 바이트 해시 = 등록 해시\n0xba9bca0b…6579f3c\n\n11월 6일 20:01:32 KST 관측\nfinalized 높이: 12,076,070\n원본 match / 변경본 file-mismatch",
    limit: "이 구현은 RPC 응답 간 정합성을 검사한다. 거래·receipt의 Merkle-Patricia 포함 증명이나 합의 검증기를 직접 실행하는 구현은 아니다.",
    refs: ["rpc","abi"],
    code: "apps/web/src/live/verification.ts:252–344",
    paths: ["apps/web/src/live/verification.ts#L252","docs/portfolio/2026-11-06-sepolia/inha-20261106/registration-finalized.json"],
    notes: "DocumentRegistered(bytes32,bytes32,uint64)의 topic0는 0x6ff0ae8cb7683b055d1eebe67d788ee55ddc6c87bd826eb7f74c23daa95965c8이다. topics[1]은 indexed documentId, data는 ABI(documentHash, issuedAt)다. 이벤트는 실행 로그이고 records는 저장 상태다. 파일 수신 파서는 등록 transactionHash를 필수로 요구한다. verifyDocument 자체 타입에서는 optional이므로 이 조건은 수신 파일 경로의 추가 보장이다. 최신 거래: https://sepolia.etherscan.io/tx/0xb75fdf3acb19b955e451e86cb3c27c2d18f3ed3079f33624a3be71afd16310eb . 증거는 docs/portfolio/2026-11-06-sepolia/registration-latest.json 및 inha-20261106/reproduction.json. 재생성 PDF의 SHA-256이 실제 등록값과 같음을 확인했으며, 사용자 브라우저에서 내려받은 파일을 직접 수집한 것은 아니다. 이 관측의 finalized 블록 시각과 수집 시각은 정확한 합의 확정 시각이 아니다. 17·18쪽에 전체 거래 해시와 탐색기 확인 절차를 정리했다.",
  },  {
    title:'PoS finality · 등록 포함과 확정 상태',
    subtitle:'거래 제출·블록 포함·최종 확정은 다르다. 현재 검증기는 노드가 보고한 finalized 기준을 사용한다.',
    leftTitle:'판정 조건과 시간 모델', mono:true,
    left:'F = eth_getBlockByNumber("finalized", false)\nR = eth_getTransactionReceipt(txHash)\nB = eth_getBlockByNumber(R.blockNumber, false)\n\nrequire B.hash == R.blockHash\nif R.blockNumber > F.number: status = pending\n\nread authorizedIssuer() at blockNumber = F.number\nread records(documentId) at blockNumber = F.number\n\nissuedAt       = issuer-supplied uint64\nreceiptBlockTime = B.timestamp\nfinalizedBlock = F.number',
    rightTitle:'합의와 관측의 차이',
    right:'PoS finality는 검증인 투표와\n체크포인트 합의에 기반한다.\n\n앱은 합의를 직접 검증하지 않고\nRPC가 제공하는 확정 블록을 읽는다.\n\n발급 기재시각은 체인이 부여하지 않는다.\n등록 블록 시각은 별도 값이다.\n\nfinalized 높이를 얻었다고\n확정된 정확한 벽시계 시각을 아는 것은 아니다.',
    limit:'몇 초 경과 또는 N개 확인만으로 확정을 대신하지 않는다. 단일 RPC에 의존하며 TSA·공인시점 인증을 구현하지 않았다. 정상 합의의 안전성 전제를 둔다.',
    refs:['pos','rpc'], code:'verification.ts:245–248,281–288,306–334',
    paths:['apps/web/src/live/verification.ts#L245'],
    notes:'화면의 확정 대기 표시는 마지막 검증 결과다. 문서 등록을 자동으로 finalized까지 계속 조회하는 동작은 현재 없다. 시간이 지난 뒤 검증을 다시 실행해야 새 finalized 높이를 읽는다. 재발급이나 새 거래 제출은 필요 없다. 등록 블록 12,076,051에 대해 2026-11-06 10:50:41 UTC 관측 당시 finalized 높이는 12,076,009로 대기 상태였다. 11:01:32 UTC 관측에서는 finalized 높이 12,076,070으로 FINALIZED_VERIFIED를 확인했고, 원본 match·변경본 file-mismatch였다. 이 두 관측 시각은 정확한 합의 확정 시각을 뜻하지 않는다. 최신 증거는 docs/portfolio/2026-11-06-sepolia/registration-latest.json에 보존한다.',
  },
  {
    title:'JSON-RPC · 고정 블록에서 eth_call',
    subtitle:'viem이 ABI 호출을 JSON-RPC 요청으로 변환한다. 검증에는 발급자 지갑이나 새 거래 승인이 필요 없다.',
    leftTitle:'records 호출의 wire format', mono:true,
    left:'B = hex(finalized.number)\nCALLDATA = "0x01e64725" + documentId_without_0x\n\n{\n  "jsonrpc": "2.0", "id": 1,\n  "method": "eth_call",\n  "params": [\n    { "to": CONTRACT, "data": CALLDATA },\n    B\n  ]\n}\n\nresult: ABI(bytes32 documentHash, uint64 issuedAt)',
    rightTitle:'현재 연결과 신뢰 전제',
    right:'단일 공개 Sepolia RPC\nethereum-sepolia-rpc.publicnode.com\n\nchainId도 먼저 대조한다.\nissuer와 records는 동일 높이로 조회한다.\n\n숫자 blockNumber로 고정하며\nblockHash 기반 EIP-1898은 미사용.\n\n실패·타임아웃은 unavailable.\n미확인을 성공으로 바꾸지 않는다.',
    limit:'체인 ID 응답과 여러 RPC 응답이 일관돼도 악성 제공자를 독립적으로 배제하지는 못한다. 자체 노드·다중 제공자·상태 증명 검증은 추가 설계 대상이다.',
    refs:['rpc'], code:'wallet.ts:7–9; verification.ts:237–248,314–334,363–365',
    paths:['apps/web/src/live/wallet.ts#L7','apps/web/src/live/verification.ts#L237'],
    notes:'RPC 예시의 CONTRACT, CALLDATA, B는 런타임 값의 자리표시자다. 실제 JSON에 이 식을 문자 그대로 넣는 것이 아니다. eth_call은 일반적으로 쓰기 코드를 모의 실행할 수도 있으나 여기서는 view getter를 호출한다.',
  },
  {
    title:'검증정보 JSON · 직렬화와 입력 검증',
    subtitle:'PDF와 분리된 detached verification envelope다. JSON 자체 전체를 서명하거나 온체인에 저장하지 않는다.',
    leftTitle:'koda-document-verification/v1', mono:true,
    left:'{\n "format": "koda-document-verification/v1",\n "chain": {"chainId": 11155111, "contract": "0x..."},\n "proof": {\n   "documentId": "0x...",     // 32 bytes, nonzero\n   "documentHash": "0x...",   // 32 bytes, nonzero\n   "issuedAt": "1793961780",  // decimal uint64 string\n   "signature": "0x...",      // 65 bytes\n   "transactionHash": "0x..." // 32 bytes, required\n }\n}\n// 위 주석은 설명용이며 실제 JSON에는 포함하지 않는다.',
    rightTitle:'파서의 신뢰 경계',
    right:'JSON 최대 64 KiB\n미지원 format·필드·체인 거절\nhex 길이·주소·uint64 범위 검사\n\n계약은 고정된 trusted 목록과 대조.\n파일이 issuer·RPC·코드를 정하지 못한다.\n\ntransactionHash는 서명 필드가 아니다.\n해당 거래의 입력·이벤트·상태와\n별도로 결속 여부를 검사한다.',
    limit:'EIP-712 typed-data를 서명하므로 JSON의 공백·필드 순서 정규화는 필요하지 않다. BTC 수량·법인명은 PDF 해시로 결속되며 JSON만으로 내용을 복구할 수 없다.',
    refs:['eip'], code:'apps/web/src/live/verification-file.ts:4–57',
    paths:['apps/web/src/live/verification-file.ts#L4'],
  },
  {
    title:'배포 검증 · 코드 일치와 발급자 신뢰',
    subtitle:'제출 파일 외부에 trust anchor를 둔다. 코드 확인과 KODA 법인 신원 인증을 같은 것으로 취급하지 않는다.',
    leftTitle:'inspectDeployment()의 실제 검사',
    left:'신뢰 설정 T = chainId, contract, issuer, deploymentTx\n\n1. chainId와 계약 코드 존재·길이 검사\n2. immutableReferences 구간을 0으로 마스킹\n   실행 코드와 컴파일 deployedBytecode 대조\n3. authorizedIssuer() = T.issuer\n4. 배포 receipt 성공 및 contractAddress 대조\n5. 배포 tx.input = 생성 바이트코드 + 생성자 인수\n6. 배포 블록 hash 및 finalized 범위 대조\n\nimmutable 값 검증은 getter·생성자 인수로 보완.\n컴파일 산출물과 설정 파일 자체를 신뢰한다.',
    rightTitle:'현재 신뢰 주소의 성격',
    right:'시험용 EOA와 시험 계약을 고정했다.\n공식 KODA 키의 인증은 아니다.\n\n배포 검사 일부는 latest 조회다.\n문서 검증의 issuer·records 조회만\n같은 finalized 높이를 사용한다.\n\n공식 주소 배포·키 교체·폐기·\n소프트웨어 배포 무결성 관리는\n서비스 운영에서 정해야 한다.',
    limit:'코드 바이트의 일치는 코드의 안전성 감사나 법인 신원의 증명이 아니다. immutable 마스킹만으로 값을 검증했다고 표현하지 않는다.',
    refs:['oz','rpc'], code:'apps/web/src/live/wallet.ts:42–70; recorded-evidence.ts:7–12',
    paths:['apps/web/src/live/wallet.ts#L42','apps/web/src/live/recorded-evidence.ts#L7'],
  },
  {
    title: "최종 판정 · 전자서명과 등록 기준의 역할",
    subtitle: "04에는 유효한 재서명과 기존 등록 원본의 불일치를 보여주는 실제 비교 사례가 있다.",
    leftTitle: "verifySignedComparison()의 판정 경로",
    mono: true,
    left: "C = candidate (signed 120 BTC PDF, no txHash)\nP = registeredProof (original proof, with txHash)\nrequire same ID; SHA256(PDF) == C.documentHash\nrequire recover712(C) == trusted.issuer\nR = verifyDocument(PDF, P, trusted, client)\n// includes tx/receipt/event/block/finality/records\nreferenceTrusted = R.signatureValid\n  && R.chainRecordValid\n  && R.status in {match, file-mismatch}\nrequire referenceTrusted\nregistrationConflict = !sameHex(C.documentHash,\n  P.documentHash) || C.issuedAt !== P.issuedAt",
    rightTitle: "실제 관측 결과 · 11월 7일",
    right: "원본: 100 BTC / 0xba9bca0b…6579f3c\n재서명: 120 BTC / 0x42c75760…df546e\n같은 문서 ID · 같은 발급 기재시각\n\nPDF와 새 서명: 일치\n서명자: 지정한 시험 발급자\n기존 등록 기록: 유효\n기존 등록 원본과 대조: 불일치\n\n새 등록 거래는 보내지 않았다.\n04 비교 사례만 지원하며\n05 일반 검증 패키지에는 미포함.",
    limit: "신뢰 발급자가 다른 내용에 다시 서명한 통제된 비교다. 서명 위조 사례가 아니다. 같은 ID 재등록은 계약이 거절하지만 다른 ID의 새 발급까지 막지는 않는다.",
    refs: ["eip","storage"],
    code: "signed-comparison.ts; verification.ts; 2026-11-07-signed-comparison/verification.json",
    paths: ["apps/web/src/live/signed-comparison.ts","apps/web/src/live/verification.ts","packages/chain/contracts/DocumentRegistry.sol","docs/portfolio/2026-11-07-signed-comparison/verification.json"],
    notes: "일반 수신 파일의 transactionHash 필수 조건은 그대로다. 비교 전용 koda-signed-comparison-v1은 등록 주장이 없는 candidate와 기존 등록 거래의 reference를 분리한다. candidate의 해시·서명을 확인한 뒤 기존 verifyDocument로 reference의 거래 입력·영수증·이벤트·정식 블록·finality·발급자·records를 모두 검사한다. 새 서명에 기존 거래 해시를 붙여 오류를 우회하지 않는다. 코드에는 같거나 다른 파일의 일반 판정도 있으며 본 슬라이드는 실제 120 BTC 비교 경로를 발췌한 것이다. 관측 finalized 높이 12077483. 실제 시험 발급자가 지갑에서 메시지 서명했고 새 온체인 등록과 가스 납부는 없었다. 변경 후 원래 바이트로 복원된 이력까지 검출하지는 않는다. 중앙 DB도 중복 ID를 거절할 수 있다. 블록체인의 추가 가치는 발급기관 DB와 통제 경계가 다른 공통 기록·합의·외부 조회에 있으며 Ethereum만 가능한 성질이라고 주장하지 않는다.",
  },  {
    title: "두 실행 환경 · 재현성과 검증 범위",
    subtitle: "같은 알고리즘·계약·신뢰 기준을 재사용한다. 별도 실행 가능성과 독립 보안 검증은 구분한다.",
    leftTitle: "실행 경로와 검수 근거",
    left: "04 브라우저\n  PDF + JSON / 로컬 해시·서명 복구 / 실시간 RPC 조회\n  인하 원본 · PDF 변경본 · 실제 재서명 비교본\n\n05 Node.js 번들 (Node 22 이상)\n  parseVerificationFile / verifyDocument 재사용\n  node verify.mjs <PDF> <JSON>\n  CLI 종료 코드: 0 match, 2 file-mismatch, 1 기타\n\n인하 원본 match / 120 BTC 변경본 file-mismatch\n실행: 11월 6일 20:12:19 KST · finalized 12,076,101\n05 화면은 보존된 실행 결과, 버튼에서 새 RPC 실행 아님",
    rightTitle: "재현의 조건",
    right: "동일 파일·서명·계약을 사용한다.\n조회한 finalized 높이는 실행마다\n달라질 수 있으므로 함께 기록한다.\n\n현재 양쪽 모두 같은 공개 RPC에 의존.\n코드·배포 설정도 공통 신뢰 전제다.\n\n검증 성공이 독립 코드 감사,\n완전한 탈중앙화, 상용 운영 승인을\n뜻하지 않는다.",
    limit: "05 패키지는 원본·PDF 변경본의 일반 검증을 지원한다. 04의 재서명 비교 전용 포맷은 지원하지 않는다. 공식 접근 권한·신뢰 목록·RPC 운영은 별도 설계 대상이다.",
    refs: ["rpc"],
    code: "tools/external-verifier/verify.ts; docs/external-verification/IMPLEMENTATION.md",
    paths: ["tools/external-verifier/verify.ts","docs/external-verification/IMPLEMENTATION.md","apps/web/public/external-verifier/manifest.json"],
    notes: "공개 기본 자료와 05 패키지는 인하테크홀딩스 발급본으로 교체됐다. manifest.json의 documentId·등록 블록·파일 해시가 신규 Inha 등록과 같다. 화면은 실제 Node 실행 결과를 보존해 보여주며, 별도 환경에서 내려받은 코드를 실행하면 RPC를 새로 조회한다. 코드·규격·고정 신뢰 설정·의존성 라이선스가 패키지에 포함된다. 동일 알고리즘을 다른 환경에서 실행하는 것과 독립적으로 감사를 받은 별도 구현은 구분한다. 두 경로는 같은 공개 RPC와 신뢰 설정을 사용한다.",
  },  {
    title:'viem client · 발급자 지갑과 제3자 조회의 분리',
    subtitle:'Wallet Client는 MetaMask의 시험 발급자만 사용한다. 수신자 검증은 Public Client의 읽기 전용 RPC 경로다.',
    leftTitle:'현재 소스 발췌 · 두 client 생성', mono:true,
    left:'export const publicClient = createPublicClient({\n  chain: sepolia,\n  transport: http(RPC_URL, {\n    retryCount: 1, timeout: 15_000\n  })\n});\n\n// injectedWallet() 내부 반환문\nreturn createWalletClient({\n  chain: sepolia, transport: custom(provider)\n});',
    rightTitle:'readContract의 실제 경로',
    right:'verifyDocument() → readContract()\n→ ABI 인코딩 → eth_call\n→ RPC 노드에서 EVM getter 실행\n→ ABI 디코딩 → 브라우저 대조\n\nauthorizedIssuer()와 records(ID)는\n같은 finalized 블록 번호로 조회한다.\n\n화면: RPC 조회 / 등록 기록 응답\n두 경로의 설명을 계속 표시한다.\n해시·서명 복구는 브라우저에서 실행.\n발급에는 signTypedData·writeContract.',
    limit:'Public Client가 “공개”라는 뜻은 무신뢰 노드라는 뜻이 아니다. 현재는 단일 공개 RPC를 사용한다. ABI·계약 주소·고정 신뢰 목록의 정확성은 별도 전제다.',
    refs:['viemPublic','viemWallet','rpc'], code:'apps/web/src/live/wallet.ts:1–15,89–99; verification.ts:237–334',
    paths:['apps/web/src/live/wallet.ts#L1','apps/web/src/live/verification.ts#L237'],
    notes:'viem 공식 문서는 Public Client의 readContract가 ABI-encoded data로 call action을 사용한다고 설명한다. 이 슬라이드는 API·계약의 실제 네트워크 동작을 설명하며, 수신자가 KODA 운영 계정을 받는다고 주장하지 않는다.',
  },
  {
    title:'실행 비용 · 오프체인 서명과 등록 거래의 구분',
    subtitle:'문서 서명·파일 검증·체인 등록·RPC 조회는 서로 다른 주체와 비용 구조를 가진다.',
    leftTitle:'누가 무엇을 실행하는가',
    left:'제3자 브라우저: SHA-256(PDF)·서명자 복구\n  로컬 연산, 체인 가스 없음\n\n시험 발급자 MetaMask\n  signTypedData(Document)\n  오프체인 서명, 등록 거래 아님\n\n시험 발급자 Wallet Client\n  simulateContract(register) → writeContract\n  Ethereum 상태 변경 거래 제출\n\n제3자 Public Client\n  eth_call / 거래·영수증·블록 조회',
    rightTitle:'가스·영수증·API 비용',
    right:'실제 등록 거래의 가스 사용량: 245,032\neffectiveGasPrice: 1,500,000,018 wei\n수수료 = 두 값의 곱\n0.000367548004410576 Sepolia ETH\n\n지갑이 승인한 거래의 송신자가 낸다.\nEIP-712 서명·eth_call에는\n온체인 가스 납부가 없다.\n\n증거 수집 스크립트가 비용을 보존한다.\n현재 데모 UI는 비용을 표시하지 않는다.\nRPC 사업자의 API 요금은 별도다.',
    limit:'Sepolia ETH는 테스트 자산이며 상용 비용 추정 근거가 아니다. 실제 운영의 발급량·가스 예산·누가 비용을 부담할지는 KODA의 운영 결정이 필요하다.',
    refs:['gas','viemWallet','viemPublic'], code:'apps/web/src/live/wallet.ts:89–99; verification.ts:252–311',
    paths:['apps/web/src/live/wallet.ts#L89','apps/web/src/live/verification.ts#L252'],
    notes:'Ethereum 공식 문서는 실제 가스비를 사용 가스량과 단위 가스 가격의 곱으로 설명한다. EIP-1559 영수증의 effectiveGasPrice를 사용한 이 식은 실제 지불액 산출에 쓰이며, 현 화면은 그 값을 별도 표기하지 않는다. simulateContract는 사전 시뮬레이션이고 상태 변경을 만들지 않으며, 후속 writeContract만 거래 제출 경로다.',
  },
  {
    title: "실증 기록 · 인하테크홀딩스 문서 등록 거래",
    subtitle: "가상 BTC 잔고 증명서의 검증정보를 Sepolia에 실제 등록했다. 아래 거래는 자산 매매·이체가 아니다.",
    leftTitle: "Transaction hash · 전체 값",
    mono: true,
    left: "0xb75fdf3acb19b955e451e86cb3c27c2d\n18f3ed3079f33624a3be71afd16310eb\n\nContract (To)\n0xC13083047C0657FF576A972469d982b51E43dCB3\n\nTrial issuer (From)\n0x5994aBF9b20319213c384a814f5C804FCF6bf9a7\n\nCall: register(documentId, hash, issuedAt, signature)\nValue: 0 ETH / Receipt: success\nBlock: 12,076,051 / Chain ID: 11155111",
    rightTitle: "시간과 비용 · 보존된 관측",
    right: "발급 기재시각\n2026-11-06 19:43:00 KST\n\n등록 블록 시각\n2026-11-06 19:44:00 KST\n\n가스 사용량: 245,032\n수수료: 0.000367548004410576\nSepolia ETH (시험 자산)\n\n20:01:32 KST 수집 당시\nfinalized 12,076,070에 포함",
    limit: "시험 계정으로 가상 증명서를 등록한 증거다. KODA 공식 발급이나 BTC 100개의 실제 보유를 증명하지 않는다. 위 시각은 정확한 합의 확정 시각과 구분한다.",
    refs: ["registration","contractExplorer"],
    code: "inha-20261106/registration-finalized.json; reproduction.json",
    paths: ["docs/portfolio/2026-11-06-sepolia/inha-20261106/registration-finalized.json","docs/portfolio/2026-11-06-sepolia/inha-20261106/reproduction.json"],
    notes: "등록 거래 전체 해시는 줄바꿈 없이 0xb75fdf3acb19b955e451e86cb3c27c2d18f3ed3079f33624a3be71afd16310eb 이다. 클릭할 탐색기 링크: https://sepolia.etherscan.io/tx/0xb75fdf3acb19b955e451e86cb3c27c2d18f3ed3079f33624a3be71afd16310eb . 계약: https://sepolia.etherscan.io/address/0xC13083047C0657FF576A972469d982b51E43dCB3 . deployment transaction과 document registration transaction은 서로 다르다. 배포 거래는 0x2bf8e548990c8e391430c7f2f3344a955e912bf1efc915740617a8d51bb80de7. 잔고 기준시점은 2026-10-31 23:59:59 KST로 PDF에 기록했다. issuedAt=1793961780은 발급자가 서명한 값이다. receipt의 gasUsed 245032 × effectiveGasPrice 1500000018 wei = 367548004410576 wei. 수수료는 이번 문서 등록만의 값이며 배포 비용과 다르다. 11월 7일 추가한 120 BTC 비교용 서명은 오프체인 메시지 서명으로 새 등록 거래가 아니다.",
  },
  {
    title: "탐색기 확인 · 거래 성공에서 원본 대조까지",
    subtitle: "Etherscan은 체인 기록을 보여주는 도구다. 문서와 기록의 관계는 우리 검증기에서 추가로 확인한다.",
    leftTitle: "거래 페이지에서 확인할 항목",
    left: "① Status / Block\n   실행 성공 여부, 포함된 블록과 시각\n② From / To / Value / Transaction Fee\n   시험 발급자 → 고정 계약, 전송액 0 ETH, 등록 비용\n③ Input Data\n   register selector 0xf0c9379a + ABI 인수\n   documentId · documentHash · issuedAt · signature\n④ Logs\n   DocumentRegistered 이벤트의 ID·해시·발급시각\n\nABI 해석 표시는 탐색기의 소스 등록 상태에 따라 다름.\n원시 input·topics·data는 로컬 ABI로 해석할 수 있다.",
    rightTitle: "우리 검증기에서 추가 확인",
    right: "제출 PDF의 SHA-256 계산\n→ 함께 받은 서명의 발급자 확인\n→ 같은 ID의 확정된 records 조회\n→ 등록 거래·이벤트와 대조\n\n원본 해시: 0xba9bca0b…6579f3c\n재서명본: 0x42c75760…df546e\n\n탐색기 Success = 등록 실행 성공\n원본 일치 = 파일·서명·등록 대조\n두 판정은 같은 뜻이 아니다.",
    limit: "등록 내용의 진실성·공식 법인 신원·증명서의 법적 효력을 탐색기 성공 표시로 판단하지 않는다. 현재 앱은 RPC 응답을 사용하며 합의·포함 증명을 직접 검증하지 않는다.",
    refs: ["registration","rpc"],
    code: "verification.ts; signed-comparison.ts; registration-finalized.json",
    paths: ["apps/web/src/live/verification.ts","apps/web/src/live/signed-comparison.ts","docs/portfolio/2026-11-06-sepolia/inha-20261106/registration-finalized.json"],
    notes: "탐색기는 https://sepolia.etherscan.io/tx/0xb75fdf3acb19b955e451e86cb3c27c2d18f3ed3079f33624a3be71afd16310eb 에서 연다. 컨트랙트 소스 검증 표시와 Read Contract 탭의 제공 여부는 이번 문서의 검증 근거로 삼지 않는다. 사용한 근거는 보존된 RPC 응답, Solidity ABI, 컴파일 산출물과 실제 파일 바이트다. Document ID: 0xdada759a9083cf2925597621c83e530e62625c56d4fbd31c1874e43926f019fe. 원본 SHA-256: 0xba9bca0bd4723155b7084a54a3bb0f41bb235b94bc4ea44fa331bc94f6579f3c. 재서명본 SHA-256: 0x42c75760d2ffded3f5ead8c19a5c7d83b20bc6d722f8b5236ac570cbe3df546e. 이벤트 topic0: 0x6ff0ae8cb7683b055d1eebe67d788ee55ddc6c87bd826eb7f74c23daa95965c8. topics[1]은 documentId, data는 ABI(documentHash, issuedAt)다.",
  },
];

export async function rewriteBatch({presentation,input}) {
  const ink='#202C3C',green='#006F4C',muted='#526579',line='#D9E3E8';
  for(const index of input.indices) {
    const item=slides[index];
    if (!item) continue;
    const slide=index<presentation.slides.items.length
      ? presentation.slides.getItem(index)
      : presentation.slides.add({width:1280,height:720});
    const pool=[...slide.shapes.items];
    for(const q of pool){q.text='';q.fill='none';q.line={fill:'none',width:0};}
    const get=i=>pool[i]??(pool[i]=slide.shapes.add({geometry:'textbox',position:{left:0,top:0,width:1,height:1},fill:'none',line:{fill:'none',width:0}}));
    const text=(i,value,x,y,w,h,size,color=ink,bold=false,mono=false)=>{const q=get(i);q.position={left:x,top:y,width:w,height:h};q.text=value;q.text.style={typeface:mono?'Consolas':'Pretendard',fontSize:size,color,bold,insets:0,verticalAlignment:'top'};return q;};
    const rect=(i,x,y,w,h,fill)=>{const q=get(i);q.position={left:x,top:y,width:w,height:h};q.fill=fill;};
    slide.background.fill='#F3F6F8';
    rect(0,44,170,734,372,'#FFFFFF');rect(1,800,170,436,372,'#E9F6F0');
    text(2,'KODA',44,28,132,50,34,ink,true);rect(3,184,28,1,52,line);
    text(4,item.title,208,32,1010,48,30,ink,true);
    text(16,slideScenes[index],56,84,1168,20,14,green,true);
    text(5,item.subtitle,56,108,1168,52,21,muted);
    text(6,item.leftTitle,64,184,698,30,20,green,true);
    text(7,item.left,64,222,698,308,item.mono?19.5:20,ink,false,item.mono);
    text(8,item.rightTitle,822,184,390,30,20,green,true);
    text(9,item.right,822,222,390,308,19,ink);
    rect(10,56,556,1168,1,line);
    text(11,`범위·한계  ${item.limit}`,56,570,1168,54,18.5,muted);
    const primary=item.refs.slice(0,2).map(k=>references[k]);
    text(12,primary[0]?`[1] ${primary[0][0]}  ${primary[0][1]}`:'',56,635,1168,20,12.7,muted);
    text(13,primary[1]?`[2] ${primary[1][0]}  ${primary[1][1]}`:'',56,656,1168,20,12.7,muted);
    text(14,`구현 근거 @${sourceCommit.slice(0,7)}: ${item.code}`,56,684,1110,20,12.6,muted);
    text(15,`A${String(index+1).padStart(2,'0')}`,1182,683,42,24,14,green,true);
    slide.speakerNotes.text=[item.title,slideScenes[index],index===0?demoStages.map(([label,detail])=>`${label}: ${detail}`).join('\n'):'',item.subtitle,item.leftTitle,item.left,item.rightTitle,item.right,`범위·한계: ${item.limit}`,item.notes??'', 'A01–A18은 부록 페이지, 01–05는 데모 장면 번호다. 05는 04 이후의 필수 절차가 아니라 외부 실행 대안이다.', '공식 참고문헌·실증 자료 (정리일 2026-11-07):',...item.refs.map(k=>`${references[k][0]}\n${references[k][1]}`),'현재 코드의 근거 (고정 소스):',...item.paths.map(p=>repo+p)].join('\n\n');
  }
  return {updated:input.indices.map(i=>i+1),slideCount:presentation.slides.items.length};
}

export function referenceMarkdown() {
  const flow='## 데모 01–05와 부록 읽는 순서\n\n01–04는 발급부터 제3자 검증까지의 본 흐름이다. 05는 외부 환경에서 같은 일반 검증을 실행하는 대안이다. A01–A18은 기술 부록 페이지 번호이며 데모 장면 번호와 구분한다.\n\n| 데모 장면 | 처리 내용 |\n| --- | --- |\n'+demoStages.map(([label,detail])=>`| ${label} | ${detail} |`).join('\n');
  return '# KODA 증빙 검증 기술 부록 — 구현 명세와 근거\n\n기술 참고용 자료. 정리일: 2026-11-07. 기준 소스: `'+sourceCommit+'`. 최신 데모 01–05의 번호·설명을 반영했으며 기술·계약·실제 등록 근거는 유지했다.\n\n'+flow+'\n\n'+slides.map((s,i)=>`## A${String(i+1).padStart(2,'0')}. ${s.title}\n\n**연결 장면:** ${slideScenes[i]}\n\n${s.subtitle}\n\n### ${s.leftTitle}\n\n${s.mono?'```text\n'+s.left+'\n```':s.left}\n\n### ${s.rightTitle}\n\n${s.right}\n\n**범위·한계:** ${s.limit}\n\n${s.notes??''}\n\n**공식 문서·실증 근거**\n\n${s.refs.map(k=>`- [${references[k][0]}](${references[k][1]})`).join('\n')}\n\n**현재 구현**\n\n${s.paths.map(p=>`- [${p}](${repo+p})`).join('\n')}\n`).join('\n');
}
