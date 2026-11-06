export const sourceCommit = '74ff79940a79657c3f72bdd39aeb41058450bf23';
const repo = `https://github.com/KODA-INHA-2026/koda-project/blob/${sourceCommit}/`;
export const references = {
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
    title: '기술 부록 · 구현 명세와 검증 근거',
    subtitle: '기술 검토용 참고자료. 표준의 보장, 현재 코드의 동작, 미구현 운영 요건을 분리한다.',
    leftTitle: '검토 기준',
    left: '기준 소스: 74ff799 (2026-11-06)\n\nPDF 해시: SHA-256 / Web Crypto\n문서 서명: EIP-712 + ECDSA / secp256k1\n등록 계약: DocumentRegistry / EVM\n컴파일러: Solidity 0.8.28 · optimizer 200 · Cancun\n라이브러리: OpenZeppelin 5.6.1 · viem 2.57.14\n실제 배포·조회: Sepolia, chainId 11155111\n\n이 부록은 기술을 변경하지 않는다.\n표준·규격과 저장소의 실제 구현을 대조한다.',
    rightTitle: '검증 명제',
    right: '제출 PDF의 전체 바이트가\n신뢰 기준에 지정한 발급자가\n서명·등록한 원본과 일치하는가?\n\n체인 기록은 KODA 내부 DB와\n분리된 대조 기준이다.\n\nBTC 실재·법인 신원·RPC 응답의\n정당성은 별도의 신뢰 전제다.',
    limit: '기획은 Ethereum 기반이다. 실증은 Sepolia에서 수행했다. KODA 상용 시스템 연동·공식 발급자 인증·Mainnet 운영을 구현했다는 의미는 없다.',
    refs: ['eip','rpc'], code: 'package.json; packages/chain/contracts/DocumentRegistry.sol',
    paths: ['package.json','packages/chain/contracts/DocumentRegistry.sol','apps/web/src/live/verification.ts'],
  },
  {
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
    title:'등록 증거 · 거래 입력, 영수증, 이벤트, 상태',
    subtitle:'거래 해시 하나로 성공을 판단하지 않는다. 제출 자료와 연결되는 등록 실행인지 여러 증거를 대조한다.',
    leftTitle:'현재 검증 순서',
    left:'1. getTransaction(txHash)\n   to = trusted.contract, from = trusted.issuer\n   register 인수의 ID·해시·issuedAt·서명 일치\n2. getTransactionReceipt(txHash)\n   status = success, from/to 일치\n3. getBlock(receipt.blockNumber)\n   block.hash = receipt.blockHash\n4. DocumentRegistered 이벤트 디코딩\n   계약 주소·ID·해시·issuedAt 일치\n5. 등록 높이 ≤ 조회한 finalized 높이\n6. finalized 높이에서 issuer / records 조회',
    rightTitle:'이벤트와 상태의 구분',
    right:'DocumentRegistered\n  topics[0] = 이벤트 시그니처 해시\n  topics[1] = indexed documentId\n  data = ABI(documentHash, issuedAt)\n\n이벤트: 거래 실행 중 발생한 로그\n상태: 계약에 저장된 현재 기준값\n\n거래 실패·무관한 등록·다른 문서의\n거래를 정상 등록으로 취급하지 않는다.',
    limit:'이 구현은 RPC 응답 간 정합성을 검사한다. 거래·receipt의 Merkle-Patricia 포함 증명이나 합의 검증기를 직접 실행하는 구현은 아니다.',
    refs:['rpc','abi'], code:'apps/web/src/live/verification.ts:252–344',
    paths:['apps/web/src/live/verification.ts#L252'],
    notes:'DocumentRegistered(bytes32,bytes32,uint64)의 topic0는 0x6ff0ae8cb7683b055d1eebe67d788ee55ddc6c87bd826eb7f74c23daa95965c8이다. 파일 수신 파서는 등록 transactionHash를 필수로 요구한다. verifyDocument 자체 타입에서는 optional이므로 이 조건은 수신 파일 경로의 추가 보장이다.',
  },
  {
    title:'PoS finality · 등록 포함과 확정 상태',
    subtitle:'거래 제출·블록 포함·최종 확정은 다르다. 현재 검증기는 노드가 보고한 finalized 기준을 사용한다.',
    leftTitle:'판정 조건과 시간 모델', mono:true,
    left:'F = eth_getBlockByNumber("finalized", false)\nR = eth_getTransactionReceipt(txHash)\nB = eth_getBlockByNumber(R.blockNumber, false)\n\nrequire B.hash == R.blockHash\nif R.blockNumber > F.number: status = pending\n\nread authorizedIssuer() at blockNumber = F.number\nread records(documentId) at blockNumber = F.number\n\nissuedAt       = issuer-supplied uint64\nreceiptBlockTime = B.timestamp\nfinalizedBlock = F.number',
    rightTitle:'합의와 관측의 차이',
    right:'PoS finality는 검증인 투표와\n체크포인트 합의에 기반한다.\n\n앱은 합의를 직접 검증하지 않고\nRPC가 제공하는 확정 블록을 읽는다.\n\n발급 기재시각은 체인이 부여하지 않는다.\n등록 블록 시각은 별도 값이다.\n\nfinalized 높이를 얻었다고\n확정된 정확한 벽시계 시각을 아는 것은 아니다.',
    limit:'몇 초 경과 또는 N개 확인만으로 확정을 대신하지 않는다. 단일 RPC에 의존하며 TSA·공인시점 인증을 구현하지 않았다. 정상 합의의 안전성 전제를 둔다.',
    refs:['pos','rpc'], code:'verification.ts:245–248,281–288,306–334',
    paths:['apps/web/src/live/verification.ts#L245'],
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
    left:'{\n "format": "koda-document-verification/v1",\n "chain": {"chainId": 11155111, "contract": "0x..."},\n "proof": {\n   "documentId": "0x...",     // 32 bytes, nonzero\n   "documentHash": "0x...",   // 32 bytes, nonzero\n   "issuedAt": "1793904567",  // decimal uint64 string\n   "signature": "0x...",      // 65 bytes\n   "transactionHash": "0x..." // 32 bytes, required\n }\n}\n// 위 주석은 설명용이며 실제 JSON에는 포함하지 않는다.',
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
    title:'최종 판정 · 전자서명과 등록 기준의 역할',
    subtitle:'서명된 파일의 무결성과 같은 문서 ID에 공개 등록된 기준의 일치를 구분한다.',
    leftTitle:'02·03 수신 경로의 성공 조건과 반례', mono:true,
    left:'S = recover712(D, signature) == trusted.issuer\nC = chainId + issuer + transaction/receipt checks\n    + canonical block + event + finality checks\nR = (record.hash == D.documentHash)\n    && (record.issuedAt == D.issuedAt)\nF = SHA256(submittedPDF) == D.documentHash\n\nMATCH requires S && C && R && F\n\nPDF alone changed: F=false (signature can detect)\nSigned alternate file, same ID: S=true, F=true\nExisting original record differs: R=false\n=> valid signature alone cannot establish registration',
    rightTitle:'블록체인 기록이 추가하는 것',
    right:'여러 수신자가 같은 ID의\n최초 등록 기준을 조회한다.\n발급기관 DB 수정과 분리된 기록이다.\n\n전자서명만으로도 파일 변경을\n탐지할 수 있다.\n\n서명된 대체 문서 비교는\n가치를 설명하는 보조 시나리오이며\n현재 화면에 구현한 사례는 아니다.',
    limit:'위 반례는 신뢰 발급자가 같은 ID의 다른 내용을 다시 서명한 상황을 가정한다. 현재 데모는 원본·PDF 변경본을 실증했다. 다른 체인·투명성 로그와의 비교도 가능하다.',
    refs:['eip','storage'], code:'verification.ts:217–365; DocumentRegistry.sol:43–60',
    paths:['apps/web/src/live/verification.ts#L217','packages/chain/contracts/DocumentRegistry.sol#L43'],
    notes:'현재 02·03의 수신 파일 경로는 transactionHash를 필수로 요구한다. verifyDocument() 함수 타입 자체에서는 optional이므로, 이 성공 명제를 임의의 함수 호출 전체에 일반화하지 않는다. 한 번 변경한 PDF를 원래 바이트로 복원하면 다시 일치한다. 따라서 결과는 현재 제출본의 원본 일치이며 모든 유통 이력의 연속 무변경 증명은 아니다. 단순한 중앙 DB에도 최초 등록 거절 규칙을 만들 수 있다. 블록체인의 추가 가치는 규칙 자체의 독점성이 아니라 공통 상태·합의·외부 조회 및 운영 통제 경계에 있다. 이 코드의 invalid 상태는 어떤 검사에서 연결이 실패했는지 trace로 구분한다.',
  },
  {
    title:'두 실행 환경 · 재현성과 검증 범위',
    subtitle:'같은 알고리즘·계약·신뢰 기준을 재사용한다. 별도 실행 가능성과 독립 보안 검증은 구분한다.',
    leftTitle:'실행 경로와 검수 근거',
    left:'02 브라우저\n  PDF + JSON 입력 / 로컬 해시·서명 복구 / RPC 조회\n03 Node.js 번들 (Node 22 이상)\n  같은 parseVerificationFile / verifyDocument 사용\n  node verify.mjs <PDF> <JSON>\n\nCLI 종료 코드: 0 match, 2 file-mismatch, 1 기타\n원본: match / 120 BTC 변경본: file-mismatch\n입력 거절 6건 / live 회귀 47건 통과 기록\n\nZIP: 소스·규격·고정 신뢰 설정·의존성 라이선스\n03 화면: 보존된 실제 실행 결과, 새 RPC 실행 아님',
    rightTitle:'재현의 조건',
    right:'동일 파일·서명·계약을 사용한다.\n조회한 finalized 높이는 실행마다\n달라질 수 있으므로 함께 기록한다.\n\n현재 양쪽 모두 같은 공개 RPC에 의존.\n코드·배포 설정도 공통 신뢰 전제다.\n\n검증 성공이 독립 코드 감사,\n완전한 탈중앙화, 상용 운영 승인을\n뜻하지 않는다.',
    limit:'실행 보고서에는 판정·해시·조회 블록·검사 시각을 보존한다. 공식 접근 권한·신뢰 목록 배포·RPC 운영과 새 서명 비교 사례는 미확정 또는 미구현이다.',
    refs:['rpc'], code:'tools/external-verifier/verify.ts; docs/external-verification/IMPLEMENTATION.md',
    paths:['tools/external-verifier/verify.ts','docs/external-verification/IMPLEMENTATION.md','apps/web/public/external-verifier/manifest.json'],
  },
  {
    title:'viem client · 발급자 지갑과 제3자 조회의 분리',
    subtitle:'Wallet Client는 MetaMask의 시험 발급자만 사용한다. 수신자 검증은 Public Client의 읽기 전용 RPC 경로다.',
    leftTitle:'현재 소스 발췌 · 두 client 생성', mono:true,
    left:'export const publicClient = createPublicClient({\n  chain: sepolia,\n  transport: http(RPC_URL, {\n    retryCount: 1, timeout: 15_000\n  })\n});\n\n// injectedWallet() 내부 반환문\nreturn createWalletClient({\n  chain: sepolia, transport: custom(provider)\n});',
    rightTitle:'readContract의 실제 경로',
    right:'verifyDocument() → readContract()\n→ ABI 인코딩 → eth_call\n→ RPC 노드에서 EVM getter 실행\n→ ABI 디코딩 → 브라우저 대조\n\nauthorizedIssuer()와\nrecords(documentId)는 같은\nfinalized 블록 번호를 사용한다.\n\n발급자의 서명·등록에는\nsignTypedData·writeContract를 쓴다.',
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
    right:'온체인 거래 수수료의 사후 계산:\n  receipt.gasUsed × receipt.effectiveGasPrice\n\n지갑이 승인한 등록 거래의\n송신자가 Sepolia ETH 가스를 낸다.\n문서 EIP-712 서명과 eth_call은\n온체인 가스를 내지 않는다.\n\n현재 검증기는 receipt의 상태·블록·\n이벤트를 대조한다. 수수료를 계산·\n표시하거나 합산하지는 않는다.\nRPC 사업자 API 요금은 별도다.',
    limit:'Sepolia ETH는 테스트 자산이며 상용 비용 추정 근거가 아니다. 실제 운영의 발급량·가스 예산·누가 비용을 부담할지는 KODA의 운영 결정이 필요하다.',
    refs:['gas','viemWallet','viemPublic'], code:'apps/web/src/live/wallet.ts:89–99; verification.ts:252–311',
    paths:['apps/web/src/live/wallet.ts#L89','apps/web/src/live/verification.ts#L252'],
    notes:'Ethereum 공식 문서는 실제 가스비를 사용 가스량과 단위 가스 가격의 곱으로 설명한다. EIP-1559 영수증의 effectiveGasPrice를 사용한 이 식은 실제 지불액 산출에 쓰이며, 현 화면은 그 값을 별도 표기하지 않는다. simulateContract는 사전 시뮬레이션이고 상태 변경을 만들지 않으며, 후속 writeContract만 거래 제출 경로다.',
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
    text(14,`구현 근거 @74ff799: ${item.code}`,56,684,1110,20,12.6,muted);
    text(15,String(index+1).padStart(2,'0'),1182,683,42,24,14,green,true);
    slide.speakerNotes.text=[item.title,item.subtitle,item.leftTitle,item.left,item.rightTitle,item.right,`범위·한계: ${item.limit}`,item.notes??'', '공식 참고문헌 (확인일 2026-11-06):',...item.refs.map(k=>`${references[k][0]}\n${references[k][1]}`),'현재 코드의 근거 (고정 소스):',...item.paths.map(p=>repo+p)].join('\n\n');
  }
  return {updated:input.indices.map(i=>i+1),slideCount:presentation.slides.items.length};
}

export function referenceMarkdown() {
  return '# KODA 증빙 검증 기술 부록 — 구현 명세와 근거\n\n기술 참고용 자료. 확인일: 2026-11-06. 기준 소스: `'+sourceCommit+'`. 현재 데모 기술·동작은 변경하지 않았다.\n\n'+slides.map((s,i)=>`## ${i+1}. ${s.title}\n\n${s.subtitle}\n\n### ${s.leftTitle}\n\n${s.mono?'```text\n'+s.left+'\n```':s.left}\n\n### ${s.rightTitle}\n\n${s.right}\n\n**범위·한계:** ${s.limit}\n\n${s.notes??''}\n\n**공식 근거**\n\n${s.refs.map(k=>`- [${references[k][0]}](${references[k][1]})`).join('\n')}\n\n**현재 구현**\n\n${s.paths.map(p=>`- [${p}](${repo+p})`).join('\n')}\n`).join('\n');
}
