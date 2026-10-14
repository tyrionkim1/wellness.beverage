"use client";
// 샘플러 상세 (요구사항 7.4) — 구성 음료·수량·용량·영양·원재료 확인, 구매 URL 없으면 출시 알림.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Dataset, loadData } from "@/lib/data";
import { ga, useGA } from "../../ga";
import { DrinkCard, SAMPLERS, Shell, img, samplerItems, won } from "../../shared";

export default function SamplerDetail() {
  const slug = useSearchParams().get("slug") || "";
  const s = SAMPLERS.find((x) => x.slug === slug);
  useGA("sampler_view", { sampler: slug });
  const [ds, setDs] = useState<Dataset | null>(null);
  useEffect(() => { loadData().then(setDs).catch(() => setDs(null)); }, []);
  const items = useMemo(() => (ds && s ? samplerItems(ds, s.slug) : []), [ds, s]);

  if (!s) return <Shell active="sampler"><main className="cd-wrap cd-page"><div className="cd-empty">샘플러를 찾을 수 없어요. <Link href="/chungdam/samplers/">목록으로</Link></div></main></Shell>;

  return (
    <Shell active="sampler">
      <main className="cd-wrap cd-page">
        <Link href="/chungdam/samplers/" className="cd-back">← 샘플러 목록</Link>
        <div className="cd-shero">
          <span className="cd-simg big"><img src={img(s.img, 900)} alt="" /><i>출시 준비 중</i></span>
          <div>
            <p className="cd-eyebrow">{s.category} 샘플러</p>
            <h1 className="cd-ptitle">{s.name}</h1>
            <p className="cd-sub">{s.desc}</p>
            <dl className="cd-sfacts">
              <dt>추천 대상</dt><dd>{s.who}</dd>
              <dt>구성</dt><dd>{s.items.length}종 · 각 1개</dd>
              <dt>구성 기준</dt><dd>{s.rule}</dd>
              <dt>예상가</dt><dd>{won(s.price)} <small>(가격 가설, 미확정)</small></dd>
              <dt>판매 상태</dt><dd>출시 준비 중</dd>
            </dl>
            <Link href="/chungdam/#signup" className="cd-btn block" onClick={() => ga("signup_start", { from: `sampler_${s.slug}` })}>출시 알림 받기</Link>
          </div>
        </div>

        <h2 className="cd-h2">구성 음료</h2>
        {!ds ? <div className="cd-empty">불러오는 중…</div> : (
          <ul className="cd-list">{items.map((d) => <DrinkCard key={d.id} d={d} ds={ds} from={`sampler_${s.slug}`} />)}</ul>
        )}
        <p className="cd-note">구성 기준: {s.rule}. 원재료가 확인된 1팩 단위 음료 중에서 고른 예시예요. 각 음료를 누르면 영양성분·원재료·알레르기 유발 원료(원재료명 표기)를 확인할 수 있어요. 실제 판매 전 구성은 바뀔 수 있습니다.</p>
      </main>
    </Shell>
  );
}
