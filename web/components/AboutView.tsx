"use client";
// 분석 방법 공개 (신뢰 축 · 랜딩 '이렇게 분석합니다')
import { useEffect, useState } from "react";
import { fmtDate, loadData, Summary } from "@/lib/data";
import { CAFFEINE_OPTS, PROTEIN_OPTS, SUGAR_OPTS } from "@/lib/filters";
import { Footer, Header } from "./ui";

export default function AboutView() {
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    loadData().then((d) => setS(d.summary)).catch(() => setS(null));
  }, []);
  const n = (v: number | undefined) => (v === undefined ? "…" : v.toLocaleString("ko-KR"));
  const pct = (a?: number, b?: number) => (a === undefined || !b ? "…" : `${Math.round((a / b) * 100)}%`);

  return (
    <>
      <Header active="about" />
      <main className="wrap prose">
        <h1>이렇게 분석합니다.</h1>

        <section>
          <h2>지금 들어 있는 데이터</h2>
          <div className="kpis">
            <div className="kpi"><b>{n(s?.count)}</b><span>바로 마시는 음료</span></div>
            <div className="kpi"><b>{pct(s?.singleServe, s?.count)}</b><span>1팩 기준 표시 가능</span></div>
            <div className="kpi"><b>{n(s?.caffeineCount)}</b><span>카페인 입력 완료</span></div>
            <div className="kpi"><b>{n(s?.imageCount)}</b><span>제품 이미지</span></div>
          </div>
          <p style={{ marginTop: 10 }}>
            수집일 <b className="mono">{fmtDate(s?.collected)}</b> · 식약처 데이터 기준일 <b className="mono">{fmtDate(s?.baseDate)}</b> · 원천 {n(s?.rawTotal)}건 중 물에 타서 먹는 제품 {n(s?.excluded)}건 제외
          </p>
        </section>

        <section>
          <h2>1. 원천 — 식약처 식품영양성분DB</h2>
          <ul>
            <li>공공데이터포털 ‘전국통합식품영양성분정보(가공식품)’ API에서 대분류 <b>음료류</b>만 받습니다.</li>
            <li>받은 원본은 날짜별로 그대로 보관하고 고치지 않습니다. 가공은 공개된 스크립트로만 해서 누구나 같은 결과를 다시 만들 수 있습니다.</li>
            <li>매주 월요일 다시 받아 새로 등록된 제품에 <b>NEW</b> 표시를 붙입니다.</li>
          </ul>
        </section>

        <section>
          <h2>2. 범위 — 바로 마시는 음료만</h2>
          <p>원두·분말, 농축액·베이스, 고형차·침출차, 인스턴트커피는 물에 타는 양에 따라 수치가 달라져 제외했습니다. 우유·가공유·특수영양식품으로 등록된 일부 프로틴 쉐이크는 식약처 분류상 ‘음료류’가 아니어서 아직 포함되지 않습니다.</p>
        </section>

        <section>
          <h2>3. 기준 — 1팩 기준, 대용량은 100ml</h2>
          <ul>
            <li>식약처 DB 수치는 100ml(또는 100g) 기준입니다.</li>
            <li>포장 1개가 <b>500ml(g) 이하</b>면 마시는 양 그대로 보이도록 <b>1팩 기준</b>으로 바꿔 보여줍니다. 계산: 100ml 수치 × 용량 ÷ 100.</li>
            <li>500ml를 넘는 대용량이나 용량 정보가 없는 제품은 <b>100ml(g) 기준</b>으로만 보여주고 카드에 표시합니다.</li>
            <li>DB에 없는 값은 <b>‘정보 없음’</b>으로 표시하고, 추정해서 채우지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2>4. 필터 — 숫자 조건만</h2>
          <table className="tbl">
            <thead><tr><th>필터</th><th>조건</th><th>정보 없는 제품</th></tr></thead>
            <tbody>
              <tr><td>단백질</td><td>{PROTEIN_OPTS.map((v) => `${v}g`).join(" / ")} 이상</td><td>필터를 켜면 제외</td></tr>
              <tr><td>당류</td><td>{SUGAR_OPTS.map((v) => `${v}g`).join(" / ")} 이하</td><td>필터를 켜면 제외</td></tr>
              <tr><td>카페인</td><td>{CAFFEINE_OPTS.map((o) => o.label).join(" / ")}</td><td>필터를 켜면 제외</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 8 }}>프리셋은 자주 쓰는 필터 조합의 바로가기입니다. 추천이나 등급이 아닙니다.</p>
        </section>

        <section>
          <h2>5. 카페인</h2>
          <p>식약처 영양성분DB에는 카페인 항목이 없습니다. 제품 포장의 표시사항을 보고 약사 확인을 거쳐 한 개씩 입력하고 있으며, 입력된 제품만 카페인 필터에 잡힙니다.</p>
        </section>

        <section>
          <h2>6. 우리가 하지 않는 것</h2>
          <ul>
            <li>제품에 등급·점수·순위를 매기지 않습니다. 정렬은 이름순과 최근 등록순뿐입니다.</li>
            <li>“당신에게 추천” 같은 추천을 하지 않습니다.</li>
            <li>질병 예방·치료나 효능을 말하지 않습니다.</li>
            <li>판매·구매 링크를 넣지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2>틀린 값을 발견하면</h2>
          <p>식약처 DB 값과 실제 포장 표시가 다를 수 있습니다. 제품명과 사진을 보내주시면 확인 후 변경 이력과 함께 고칩니다.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
