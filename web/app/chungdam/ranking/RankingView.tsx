"use client";
// 기준 공개 랭킹 (요구사항 4.3) — 성분 기준 정렬. 인기순은 사용자 데이터 확보 후.
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Dataset, fmtDate, loadData } from "@/lib/data";
import { ga, useGA } from "../ga";
import { DrinkCard, RANKINGS, RankKey, Shell, rank } from "../shared";

const TOP = 30;

export default function RankingView() {
  const sp = useSearchParams();
  const router = useRouter();
  const init = (RANKINGS.find((r) => r.key === sp.get("c"))?.key || "lowsugar") as RankKey;
  const [k, setK] = useState<RankKey>(init);
  const [ds, setDs] = useState<Dataset | null>(null);
  useGA("ranking_view", { category: init, from: "page" });
  useEffect(() => { loadData().then(setDs).catch(() => setDs(null)); }, []);
  const r = useMemo(() => (ds ? rank(ds, k) : null), [ds, k]);
  const def = RANKINGS.find((x) => x.key === k)!;

  const pick = (key: RankKey) => {
    setK(key);
    router.replace(`/chungdam/ranking/?c=${key}`, { scroll: false });
    ga("ranking_view", { category: key, from: "tab" });
  };

  return (
    <Shell active="rank">
      <main className="cd-wrap cd-page">
        <p className="cd-eyebrow">기준 공개 랭킹</p>
        <h1 className="cd-ptitle">숫자로 정렬한 음료 랭킹</h1>
        <p className="cd-sub">점수나 광고 없이, 공개된 성분 기준으로만 순서를 매겼어요.</p>

        <div className="cd-sort wide" role="tablist" aria-label="랭킹 카테고리">
          {RANKINGS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={k === x.key} className={k === x.key ? "on" : ""} onClick={() => pick(x.key)}>{x.label}</button>
          ))}
        </div>

        <section className="cd-rule">
          <h2>{def.title} · 산정 기준</h2>
          <dl>
            <dt>비교 단위</dt><dd>{def.unit}</dd>
            <dt>포함 대상</dt><dd>{def.rule[0]}</dd>
            <dt>정렬·동률</dt><dd>{def.rule[1]}</dd>
            <dt>제외</dt><dd>{def.rule[2]}{r ? ` (이번 기준에서 ${r.excluded.toLocaleString("ko-KR")}개 제외)` : ""}</dd>
            <dt>데이터</dt><dd>식약처 식품영양성분DB{ds?.summary.baseDate ? ` · 기준일 ${fmtDate(ds.summary.baseDate)}` : ""}{ds ? ` · 수집 ${fmtDate(ds.summary.collected)}` : ""}</dd>
          </dl>
        </section>

        {!r ? <div className="cd-empty">불러오는 중…</div> : (
          <>
            <p className="cd-res-meta">기준을 충족한 음료 <b>{r.list.length.toLocaleString("ko-KR")}</b>개 중 상위 {Math.min(TOP, r.list.length)}개</p>
            <ul className="cd-list">{r.list.slice(0, TOP).map((d, i) => <DrinkCard key={d.id} d={d} ds={ds!} rankNo={i + 1} from={`ranking_${k}`} />)}</ul>
          </>
        )}
        <p className="cd-note">랭킹은 표시된 성분 수치의 순서일 뿐 제품의 품질·효능 평가가 아닙니다. 사용자 조회·저장 데이터가 쌓이면 인기순을 별도로 제공할 예정이에요. 향후 광고 상품은 랭킹과 분리해 광고임을 표시합니다.</p>
      </main>
    </Shell>
  );
}
