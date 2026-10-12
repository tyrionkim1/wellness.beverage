// 제품 이미지: 누끼 이미지가 있으면 그것을, 없으면 포장 형태 실루엣(장식용)을 보여준다.
import { BASE, Drink, Shape } from "@/lib/data";

const TONE: Record<string, [string, string]> = {
  // [본체, 라벨] — 종류별 톤. 수치의 좋고 나쁨과 무관한 장식색.
  액상음료: ["#F2EBDD", "#2E2E33"],
  "과·채주스": ["#FFD9A8", "#C8461B"],
  액상차: ["#D6E6C3", "#3E5B2E"],
  "과·채음료": ["#FFE7A3", "#9A6A00"],
  액상커피: ["#2A211C", "#E8D6C4"],
  탄산음료: ["#1F2A33", "#E9F1F7"],
  "인삼/홍삼음료": ["#5A2A1F", "#E8C9A0"],
  두유: ["#F4EEE4", "#6B4A33"],
  발효음료: ["#EDE3F2", "#5B3B73"],
  유산균음료: ["#F7F1E6", "#C0392B"],
  탄산수: ["#CFE6EE", "#1B4D5C"],
  효모음료: ["#EFE6D2", "#6A5A2E"],
};

function Silhouette({ shape, body, label }: { shape: Shape; body: string; label: string }) {
  const accent = "#FF4A1C";
  switch (shape) {
    case "can":
      return (
        <svg viewBox="0 0 120 200" aria-hidden="true">
          <ellipse cx="60" cy="194" rx="32" ry="4" fill="#000" opacity=".35" />
          <rect x="32" y="16" width="56" height="10" rx="4" fill="#BFC3C8" />
          <path d="M30 26h60l-2 6v150l2 6H30l2-6V32z" fill={body} />
          <rect x="32" y="66" width="56" height="78" fill={label} opacity=".18" />
          <rect x="40" y="82" width="32" height="7" rx="3" fill={label} />
          <rect x="40" y="95" width="22" height="4" rx="2" fill={label} opacity=".55" />
          <rect x="40" y="120" width="40" height="3" fill={accent} />
          <rect x="32" y="182" width="56" height="8" rx="3" fill="#BFC3C8" />
          <path d="M40 34v144" stroke="#fff" strokeOpacity=".25" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case "carton":
      return (
        <svg viewBox="0 0 120 200" aria-hidden="true">
          <ellipse cx="60" cy="192" rx="40" ry="5" fill="#000" opacity=".35" />
          <path d="M26 34 60 14l34 20z" fill={body} opacity=".85" />
          <rect x="26" y="34" width="68" height="156" rx="4" fill={body} />
          <rect x="26" y="84" width="68" height="70" fill={label} />
          <rect x="34" y="96" width="40" height="6" rx="3" fill={body} opacity=".9" />
          <rect x="34" y="108" width="28" height="4" rx="2" fill={body} opacity=".6" />
          <rect x="34" y="132" width="20" height="14" rx="3" fill={accent} />
          <rect x="85" y="4" width="4" height="34" rx="2" fill="#D9D2C6" />
          <path d="M26 34v156" stroke="#fff" strokeOpacity=".5" strokeWidth="3" />
        </svg>
      );
    case "pouch":
      return (
        <svg viewBox="0 0 120 200" aria-hidden="true">
          <ellipse cx="60" cy="194" rx="36" ry="4" fill="#000" opacity=".35" />
          <rect x="50" y="8" width="20" height="18" rx="3" fill="#D9D9D9" />
          <path d="M30 26h60c4 0 6 3 6 6l-4 150c0 5-4 9-9 9H37c-5 0-9-4-9-9l-4-150c0-3 2-6 6-6z" fill={body} />
          <rect x="34" y="80" width="52" height="64" rx="6" fill={label} />
          <rect x="42" y="94" width="34" height="6" rx="3" fill={body} />
          <rect x="42" y="106" width="22" height="4" rx="2" fill={body} opacity=".6" />
          <circle cx="74" cy="130" r="7" fill={accent} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 200" aria-hidden="true">
          <ellipse cx="60" cy="194" rx="34" ry="4" fill="#000" opacity=".35" />
          <rect x="48" y="4" width="24" height="16" rx="3" fill="#E8E8E8" />
          <path d="M50 20h20v10c0 8 22 14 22 34v118c0 6-4 10-10 10H38c-6 0-10-4-10-10V64c0-20 22-26 22-34z" fill={body} fillOpacity=".75" stroke="#fff" strokeOpacity=".35" />
          <rect x="28" y="92" width="64" height="56" fill={label} />
          <rect x="36" y="104" width="36" height="6" rx="3" fill={body} />
          <rect x="36" y="116" width="24" height="4" rx="2" fill={body} opacity=".6" />
          <rect x="36" y="134" width="14" height="6" rx="2" fill={accent} />
          <path d="M38 70v100" stroke="#fff" strokeOpacity=".6" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function Pack({ d, className }: { d: Drink; className?: string }) {
  if (d.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={className} src={`${BASE}/img/${d.image}`} alt={`${d.name} 제품 이미지`} loading="lazy" decoding="async" />
    );
  }
  const [body, label] = TONE[d.type] || ["#E8E8E8", "#2E2E33"];
  return (
    <span className={className} role="img" aria-label={`${d.type} 포장 일러스트`}>
      <Silhouette shape={d.shape} body={body} label={label} />
    </span>
  );
}
