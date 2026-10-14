"use client";
// 샘플러 목록 (요구사항 7.2) — 판매 전이므로 '출시 준비 중' + 출시 알림. 가격은 가설(예상가).
import Link from "next/link";
import { useGA } from "../ga";
import { SAMPLERS, Shell, img, won } from "../shared";

export default function SamplersView() {
  useGA("sampler_list_view");
  return (
    <Shell active="sampler">
      <main className="cd-wrap cd-page">
        <p className="cd-eyebrow">샘플러</p>
        <h1 className="cd-ptitle">사기 전에, 먼저 조금씩</h1>
        <p className="cd-sub">온라인 음료는 20개입 묶음이 많아 새 제품을 시도하기 어렵죠. 같은 카테고리 음료 여러 종을 소량으로 묶어 준비하고 있어요.</p>
        <div className="cd-samplers list">
          {SAMPLERS.map((s) => (
            <Link key={s.slug} href={`/chungdam/samplers/s/?slug=${s.slug}`} className="cd-scard">
              <span className="cd-simg"><img src={img(s.img, 640)} alt="" loading="lazy" /><i>출시 준비 중</i></span>
              <span className="cd-stxt">
                <small>{s.category} · 구성 {s.items.length}종</small>
                <b>{s.name}</b>
                <span className="cd-sdesc">{s.desc}</span>
                <em>예상가 {won(s.price)}</em>
              </span>
            </Link>
          ))}
        </div>
        <p className="cd-note">구성과 가격은 기획 예시이며 확정되지 않았습니다. 소량 구성·재포장 가능 여부, 표시사항, 배송 조건을 확인한 뒤 판매를 시작해요. 결제 기능은 아직 없습니다.</p>
      </main>
    </Shell>
  );
}
