"use client";
// 방법 — 득근음료 '방법' 화면과 같은 구성(데이터 지표 → 번호 매긴 원칙). 내용은 청담 기준.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Dataset, fmtDate, loadData } from "@/lib/data";
import { useGA } from "../ga";
import { CONC_PROTEIN, LOW_SUGAR, NO_SUGAR, PROTEIN_PACK, RANKINGS, SAMPLERS, Shell, isConcentrate, won } from "../shared";

export default function AboutView() {
  useGA("about_view");
  const [ds, setDs] = useState<Dataset | null>(null);
  useEffect(() => { loadData().then(setDs).catch(() => setDs(null)); }, []);
  const m = useMemo(() => {
    if (!ds) return null;
    const n = ds.drinks.length;
    const pct = (x: number) => `${Math.round((x / n) * 100)}%`;
    return {
      count: ds.summary.count.toLocaleString("ko-KR"),
      single: pct(ds.drinks.filter((d) => d.single).length),
      ingr: pct(ds.drinks.filter((d) => d.hasIngr).length),
      conc: ds.drinks.filter(isConcentrate).length.toLocaleString("ko-KR"),
    };
  }, [ds]);

  return (
    <Shell active="about">
      <main className="cd-wrap cd-page cd-narrow cd-about">
        <h1 className="cd-ptitle">이렇게 고릅니다.</h1>

        <h2>지금 들어 있는 데이터</h2>
        <div className="cd-stats">
          <div><b>{m?.count ?? "…"}</b><span>바로 마시는 음료</span></div>
          <div><b>{m?.single ?? "…"}</b><span>1팩 기준 표시 가능</span></div>
          <div><b>{m?.ingr ?? "…"}</b><span>원재료 확보</span></div>
          <div><b>{m?.conc ?? "…"}</b><span>비교 부적합 제외</span></div>
        </div>
        <p className="cd-sub">수집일 {ds ? fmtDate(ds.summary.collected) : "…"} · 식약처 데이터 기준일 {ds ? fmtDate(ds.summary.baseDate) : "…"}</p>

        <h2>1. 원천 — 식약처 공공데이터</h2>
        <ul>
          <li>영양성분은 식품의약품안전처 식품영양성분DB(공공데이터포털)에서 매주 받아옵니다.</li>
          <li>원재료명은 식품안전나라 품목제조보고에서 품목보고번호로 찾아 붙입니다.</li>
          <li>받은 값은 고치거나 추정하지 않습니다. 값이 없으면 &lsquo;정보 없음&rsquo;으로 표시하고 0으로 간주하지 않습니다.</li>
        </ul>

        <h2>2. 비교 부적합 — 이런 값은 빼고 비교합니다</h2>
        <ul>
          <li>100ml당 단백질 {CONC_PROTEIN}g 초과: 농축·분말형이거나 입력 오류로 추정.</li>
          <li>단백질 열량(단백질 g × 4)이 총열량보다 큰 값: 입력 오류로 추정.</li>
          <li>단백질 조건·랭킹에서는 콜라겐·아미노산(아르기닌 등) 제품과, 원재료에 단백 원료가 없는 제품을 뺍니다.</li>
        </ul>

        <h2>3. 기준 — 1팩, 대용량은 100ml</h2>
        <ul>
          <li>포장 1개가 500ml(g) 이하이면 마시는 양 그대로 1팩 기준으로 보여줍니다. 계산: 100ml 수치 × 용량 ÷ 100.</li>
          <li>500ml를 넘거나 용량 정보가 없으면 100ml(g) 기준으로 보여줍니다.</li>
          <li>식약처 DB에 1회 섭취량 항목이 없어, 1팩을 1회분으로 간주합니다.</li>
        </ul>

        <h2>4. 목표와 조건</h2>
        <table className="cd-tbl">
          <thead><tr><th>목표</th><th>함께 켜지는 조건</th></tr></thead>
          <tbody>
            <tr><td>당류 관리</td><td>100ml당 당류 {LOW_SUGAR}g 이하 · 당류 낮은 순</td></tr>
            <tr><td>체지방 관리</td><td>당류 5g · 열량 30kcal 이하(100ml) · 열량 낮은 순</td></tr>
            <tr><td>단백질 보충</td><td>1팩 단백질 {PROTEIN_PACK}g 이상 · 당류 5g 이하 · 단백질 높은 순</td></tr>
            <tr><td>식물성 식단</td><td>식물성 단백 원료 · 유제품 원료 제외</td></tr>
            <tr><td>카페인 줄이기</td><td>원재료에 카페인 원료 없음</td></tr>
          </tbody>
        </table>
        <p className="cd-note">여러 조건을 고르면 모두 만족하는 음료만 보여줍니다(AND). 장 건강·면역·수면·피부 목표는 표시·광고 기준 검토 후 추가할 예정입니다.</p>

        <h2>5. 태그 — 기준을 넘었는지만 말합니다</h2>
        <ul>
          <li><b>무당 기준 충족</b> 100ml당 당류 {NO_SUGAR}g 미만 · <b>저당 기준 충족</b> {LOW_SUGAR}g 미만.</li>
          <li><b>락토프리 표기 · 식물성 단백 · 카페인 원료 없음 · 식이섬유 원료 · 유산균 원료</b>는 원재료명 표기로만 판정합니다. 원재료가 없는 제품에는 붙이지 않습니다.</li>
          <li>태그는 효능이나 인증이 아닙니다. 당류가 낮다는 사실만으로 혈당 반응이 낮다고 단정할 수 없습니다.</li>
        </ul>

        <h2>6. 랭킹 — 기준을 공개합니다</h2>
        {RANKINGS.map((r) => (
          <div key={r.key} className="cd-rule">
            <h3>{r.label} · {r.unit}</h3>
            <dl><dt>포함</dt><dd>{r.rule[0]}</dd><dt>정렬</dt><dd>{r.rule[1]}</dd><dt>제외</dt><dd>{r.rule[2]}</dd></dl>
          </div>
        ))}
        <p className="cd-note">인기순은 사용자 조회 데이터가 쌓인 뒤 따로 제공합니다. 광고 상품은 랭킹과 분리해 광고임을 표시합니다. <Link href="/chungdam/ranking/">랭킹 보기 →</Link></p>

        <h2>7. 샘플러 (출시 준비 중)</h2>
        <p>박스로 사기 전에 같은 카테고리 음료를 소량으로 맛볼 수 있도록 준비 중입니다. 지금은 판매·결제를 하지 않고 출시 알림만 받습니다.</p>
        <ul>{SAMPLERS.map((s) => <li key={s.slug}><b>{s.name}</b> 예상가 {won(s.price)} — {s.rule}</li>)}</ul>

        <h2>8. 우리가 하지 않는 것</h2>
        <ul>
          <li>제품에 점수·등급을 매기지 않습니다. 랭킹은 공개된 성분 기준의 순서입니다.</li>
          <li>질병 예방·치료나 효능을 말하지 않습니다.</li>
          <li>첨가물의 존재만으로 유해하다고 판단하지 않습니다.</li>
          <li>건강 상태 같은 민감정보는 받지 않습니다.</li>
        </ul>

        <h2>틀린 값을 발견하면</h2>
        <p>식약처 DB 값과 실제 포장 표시가 다를 수 있습니다. 제품명과 포장 사진을 보내주시면 확인 후 변경 이력과 함께 고칩니다.</p>
      </main>
    </Shell>
  );
}
