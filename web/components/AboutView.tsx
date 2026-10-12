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
            <div className="kpi"><b>{pct(s?.ingredientCount, s?.count)}</b><span>원재료 확보</span></div>
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
          <h2>5. 원재료 태그 — 들어 있다 / 없다만 말한다</h2>
          <ul>
            <li>식품안전나라 ‘품목제조보고(원재료)’에서 품목보고번호로 원재료명을 받아, 이름이 들어 있는지만 확인해 태그를 붙입니다. 예: 유산균 원료, 식물성 단백 원료, 감미료(알룰로스·수크랄로스 등), 유제품 원료 없음.</li>
            <li>태그는 <b>효능이나 인증이 아닙니다.</b> ‘락토프리’는 제품명에 그렇게 표기된 경우만 따로 표시하고, ‘유제품 원료 없음’은 원재료명 기준 사실입니다.</li>
            <li>수입식품은 품목제조보고 대상이 아니어서 원재료가 없을 수 있고, 복합원재료의 하위 성분은 원재료명에 안 나올 수 있습니다.</li>
            <li>‘혈당’ 같은 기능 표현은 쓰지 않습니다. 관련 원료(난소화성말토덱스트린 등)는 ‘식이섬유 원료’ 태그로만 보여줍니다.</li>
          </ul>
        </section>

        <section>
          <h2>6. 숫자를 생활 단위로</h2>
          <ul>
            <li><b>하루 기준치 %</b> — 식품 등의 표시기준 1일 영양성분 기준치 대비 (단백질 55g, 당류 100g, 나트륨 2,000mg 등).</li>
            <li><b>단백질 비중</b> — 열량 중 단백질에서 오는 비율 = 단백질 g × 4 ÷ 열량.</li>
            <li><b>각설탕 환산</b> — 당류 ÷ 3g (0.5개 단위).</li>
            <li><b>카페인</b> — 성인 1일 최대 섭취권고량 400mg 대비 %.</li>
            <li>모두 같은 숫자를 다른 단위로 바꾼 것일 뿐, 좋고 나쁨을 매기지 않습니다.</li>
          </ul>
        </section>

        <section>
          <h2>7. 맛 기록</h2>
          <p>팀 시음 패널이 블라인드로 마셔보고 ‘널리 알려진 음료보다 덜 달다’ 같은 기준 음료 대비 한 문장과 단맛·산미·탄산·바디감·뒷맛(약/중/강)을 기록합니다. 점수나 별점은 매기지 않습니다. 현재 기록 {n(s?.tasteCount)}개.</p>
        </section>

        <section>
          <h2>8. 샘플러 (사전 신청)</h2>
          <p>박스로 사기 전에 1개씩 맛보고 싶은 수요가 있는지 확인하는 중입니다. 지금은 판매·결제 없이 담은 조합과 원하는 가격, 이메일만 받고, 화면 이용 기록은 익명(세션 단위)으로만 집계합니다.</p>
        </section>

        <section>
          <h2>9. 카페인</h2>
          <p>식약처 영양성분DB에는 카페인 항목이 없습니다. 제품 포장의 표시사항을 보고 약사 확인을 거쳐 한 개씩 입력하고 있으며, 입력된 제품만 카페인 필터에 잡힙니다.</p>
        </section>

        <section>
          <h2>10. 우리가 하지 않는 것</h2>
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
