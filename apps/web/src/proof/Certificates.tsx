import { useState } from "react";
import { defineControls } from "tempo-sdk/assets";

export function FullCertificate() { return (<div className="doc"><div className="dt">디지털자산 보관 잔고 증명서</div>
<div className="ds">발행 KODA · 문서번호 KP-2026-0930-0417 </div>
<div className="kv"><dt>법인명</dt><dd>㈜가온테크</dd><dt>기준일</dt><dd className="mono">2026-09-30 23:59:59 KST</dd><dt>BTC 보관 지갑</dt><dd className="mono" style={{"fontSize": "11.5px"}}>bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz</dd><dt>거래 상대방</dt><dd>OTC 거래상대 A사 외 1곳 (가상)</dd></div>
<table className="tbl" style={{"marginTop": "9px"}}><tbody><tr><th>자산</th><th className="r">수량</th><th className="r">평가액(기준가)</th></tr><tr><td>BTC</td><td className="r mono">12.4500</td><td className="r mono">₩ 1,942,110,000</td></tr>
<tr><td>ETH</td><td className="r mono">310.2000</td><td className="r mono">₩ 1,563,408,000</td></tr>
<tr><td>USDC</td><td className="r mono">1,250,000.00</td><td className="r mono">₩ 1,736,250,000</td></tr></tbody></table>
<div className="seal"><span>서명 <b className="mono">did:koda:issuer:koda-ops</b></span><span>3분기 거래 <b>12건</b></span><span>기준가 <b className="mono">09-30 23:59 KST</b> · 출처 표기 (가상)</span></div></div>); }
defineControls(FullCertificate, {});

export function MaskedCertificate() { return (<div className="doc"><div className="dt">디지털자산 보관 잔고 증명서</div>
<div className="ds">발행 KODA · 문서번호 KP-2026-0930-0417 <span className="tag ok">원본 기반 열람본 · 일부 가림</span></div>
<div className="kv"><dt>법인명</dt><dd>㈜가온테크</dd><dt>기준일</dt><dd className="mono">2026-09-30 23:59:59 KST</dd>
<dt>BTC 보관 지갑</dt><dd className="mono" style={{"fontSize": "11.5px"}}>bc1q ●●●● ●●●● ●●●● ●●●● x9tz <span className="tag hide">앞뒤 4자리</span></dd>
<dt>거래 상대방</dt><dd><span className="redact" style={{"width": "150px"}}></span> <span className="tag hide">가림</span></dd>
<dt>3분기 거래</dt><dd>12건 <span className="redact" style={{"width": "90px"}}></span> <span className="tag hide">건수만</span></dd></div>
<table className="tbl" style={{"marginTop": "9px"}}><tbody><tr><th>자산</th><th className="r">수량</th><th className="r">평가액(기준가)</th></tr><tr><td>BTC</td><td className="r mono">12.4500</td><td className="r mono">₩ 1,942,110,000</td></tr>
<tr><td>ETH</td><td className="r mono">310.2000</td><td className="r mono">₩ 1,563,408,000</td></tr>
<tr><td>USDC</td><td className="r mono">1,250,000.00</td><td className="r mono">₩ 1,736,250,000</td></tr></tbody></table></div>); }
defineControls(MaskedCertificate, {});

const extraTransactions = [["07-03", "A사", "+1.0000 BTC", "2ab1…a001"], ["07-21", "B사", "+50.00 ETH", "0x41…0012"], ["08-05", "A사", "−0.5000 BTC", "bc21…a003"], ["08-14", "B사", "+200,000 USDC", "0x51…0014"], ["08-20", "A사", "+0.2500 BTC", "cd31…a005"], ["09-02", "B사", "+40.20 ETH", "0x61…0016"], ["09-11", "A사", "−100,000 USDC", "0x71…0017"], ["09-28", "B사", "+0.2500 BTC", "ef41…a008"]];
export function AuditorCertificate() { const [expanded, setExpanded] = useState(false); return (<div className="doc" style={{"display": "grid", "gridTemplateColumns": "1fr 1fr", "gap": "22px"}}>
<div><div className="dt">디지털자산 보관 잔고 증명서</div>
<div className="ds">발행 KODA · 문서번호 KP-2026-0930-0417 </div>
<div className="kv" style={{"gridTemplateColumns": "78px 1fr"}}><dt>법인명</dt><dd>㈜가온테크</dd><dt>BTC 지갑</dt><dd className="mono" style={{"fontSize": "10.5px"}}>bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz</dd><dt>거래 상대방</dt><dd><b>OTC 거래상대 A사</b>, B사 (가상)</dd></div>
<table className="tbl" style={{"marginTop": "9px"}}><tbody><tr><th>자산</th><th className="r">수량</th><th className="r">평가액(원)</th></tr><tr><td>BTC</td><td className="r mono">12.4500</td><td className="r mono">1,942,110,000</td></tr>
<tr><td>ETH</td><td className="r mono">310.2000</td><td className="r mono">1,563,408,000</td></tr>
<tr><td>USDC</td><td className="r mono">1,250,000.00</td><td className="r mono">1,736,250,000</td></tr></tbody></table></div>
<div><div className="lbl">3분기 거래 12건</div>
<table className="tbl" style={{"marginTop": "5px", "fontSize": "12px"}}><tbody>
<tr><th>일자</th><th>상대방</th><th className="r">수량</th><th>Tx</th></tr>
<tr><td className="mono">07-14</td><td>A사</td><td className="r mono">+2.0000 BTC</td><td className="mono">4f1a…a21c</td></tr>
<tr><td className="mono">08-02</td><td>B사</td><td className="r mono">−80.00 ETH</td><td className="mono">0x9b…07de</td></tr>
<tr><td className="mono">08-29</td><td>A사</td><td className="r mono">+500,000 USDC</td><td className="mono">0x12…e9f0</td></tr>
<tr><td className="mono">09-17</td><td>B사</td><td className="r mono">+0.4500 BTC</td><td className="mono">77c0…3b51</td></tr>
{expanded && extraTransactions.map((t, i) => <tr key={i}>{t.map((v, j) => <td key={j}>{v}</td>)}</tr>)}<tr><td colSpan={4}><button className="text-action" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "거래 내역 접기" : "외 8건 펼치기"}</button></td></tr>
</tbody></table></div></div>); }
defineControls(AuditorCertificate, {});

export function ChangedCertificate() { return (<div className="doc"><div className="dt">디지털자산 보관 잔고 증명서</div>
<div className="ds">발행 KODA · 문서번호 KP-2026-0930-0417 <span className="tag bad">올린 사본 · 원본과 비교</span></div>
<div className="kv"><dt>법인명</dt><dd>㈜가온테크</dd><dt>기준일</dt><dd className="mono">2026-09-30 23:59:59 KST</dd><dt>BTC 보관 지갑</dt><dd className="mono" style={{"fontSize": "11.5px"}}>bc1q8f2kv7dm3n0w4h6ys5tqe2rj9pl0c3gu5ax9tz</dd><dt>거래 상대방</dt><dd>OTC 거래상대 A사 외 1곳 (가상)</dd></div>
<table className="tbl" style={{"marginTop": "9px"}}><tbody><tr><th>자산</th><th className="r">수량</th><th className="r">평가액(기준가)</th></tr><tr><td>BTC</td><td className="r mono"><span className="diff">15.4500</span><div style={{"fontSize": "11px", "color": "var(--sub)"}}>원본 12.4500</div></td><td className="r mono"><span className="diff">₩ 2,410,088,000</span><div style={{"fontSize": "11px", "color": "var(--sub)"}}>원본 ₩ 1,942,110,000</div></td></tr>
<tr><td>ETH</td><td className="r mono">310.2000</td><td className="r mono">₩ 1,563,408,000</td></tr>
<tr><td>USDC</td><td className="r mono">1,250,000.00</td><td className="r mono">₩ 1,736,250,000</td></tr></tbody></table></div>); }
defineControls(ChangedCertificate, {});

export function MaskingMatrix() { return (<div className="main">
<div className="lbl">마스킹 기준표 · v0.2 제안안</div>
<div className="h1" style={{"marginTop": "4px"}}>누구에게 무엇을 숨기는가</div>
<table className="mx" style={{"marginTop": "18px"}}><tbody>
<tr><th style={{"width": "250px"}}>증명서 항목</th><th style={{"width": "170px", "textAlign": "center"}}>고객사<br />재무·회계</th><th style={{"width": "150px", "textAlign": "center"}}>외부 감사인</th><th>가리는 이유</th></tr>
<tr><td>법인명 · 기준일 · 발행 시각</td><td className="c">●</td><td className="c">●</td><td className="why">증빙의 주체와 시점 확인</td></tr>
<tr><td>자산 종류 · 수량 · 평가액</td><td className="c">●</td><td className="c">●</td><td className="why">회계 처리와 감사에 필수</td></tr>
<tr><td><b>보관 지갑 주소</b></td><td className="c">◐<small>앞뒤 4자리</small></td><td className="c">●</td><td className="why">주소가 돌면 보유 자산과 거래 흐름이 그대로 추적된다</td></tr>
<tr><td><b>거래 상대방</b></td><td className="c">○<small>가림</small></td><td className="c">●</td><td className="why">비밀유지약정, 장기 계약 공시 과정에서 상대방이 드러날 위험</td></tr>
<tr><td><b>개별 거래 내역 (Tx)</b></td><td className="c">◐<small>건수만</small></td><td className="c">●</td><td className="why">Tx 해시 하나로 블록 탐색기에서 상대방 주소가 보인다</td></tr>
<tr><td>문서 지문(해시) · 체인 기록</td><td className="c">●</td><td className="c">●</td><td className="why">누구나 원본 여부를 검증할 수 있어야 한다</td></tr>
</tbody></table>
<div className="legend" style={{"marginBottom": "4px"}}><span>KODA 발행 원본은 모든 항목을 담는다. KODA 내부 승인·운영 정보는 증명서에 넣지 않는다(과제 제외 범위).</span></div>
<div className="legend"><span>● 전체 공개</span><span>◐ 일부 공개</span><span>○ 가림</span><span>감사인 전체 열람은 11/1 결정에 따른 시연용 권한 설정</span></div>
</div>); }
defineControls(MaskingMatrix, {});
