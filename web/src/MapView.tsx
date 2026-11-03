import { useMemo, useState } from "react";
import { childrenOf, LEVELS, masses, type KnowledgeMap } from "../../shared/map";

// The map shows one topic at a time: the focus in the middle, its children around it, and the
// children's own children as tiny dots hinting there's more inside. Dots keep their identity
// between views, so clicking one slides it to the middle instead of redrawing everything.

const W = 1000;
const H = 720;
const RX = 370;
const RY = 255;
/** Above this many dots around the focus, they alternate between two rings to fit their labels. */
const ONE_RING_MAX = 14;

type Kind = "root" | "center" | "child" | "grand" | "suggestion" | "grand-suggestion" | "related";

type Dot = {
  key: string;
  kind: Kind;
  x: number;
  y: number;
  r: number;
  /** 0 (nothing known) to 1, how solid the dot is drawn. */
  fill: number;
  label: string | null;
  labelY: number;
  title: string;
  detail: string;
  onClick?: () => void;
};

/** Radius from knowledge, by area: a dot with four times the knowledge has twice the extra radius. */
const radiusOf = (mass: number, scale = 1) => Math.min(64, (13 + 9 * Math.sqrt(mass)) * scale);
const fillOf = (mass: number) => Math.min(1, 0.12 + 0.2 * Math.sqrt(mass));

export default function MapView({
  map,
  focus,
  selectedSuggestion,
  onFocus,
  onSuggestion,
}: {
  map: KnowledgeMap;
  focus: string | null;
  selectedSuggestion: string | null;
  onFocus: (id: string | null) => void;
  onSuggestion: (id: string) => void;
}) {
  const [hover, setHover] = useState<{ dot: Dot; x: number; y: number } | null>(null);

  const { dots, edges } = useMemo(() => {
    const mass = masses(map);
    const children = childrenOf(map);
    const byId = new Map(map.topics.map((t) => [t.id, t]));
    const m = (id: string) => mass.get(id) ?? 0;
    const describe = (id: string) => {
      const t = byId.get(id)!;
      const below = children.get(id)?.length ?? 0;
      const own = t.score === null ? "Not scored yet" : `${t.score}/5: ${LEVELS[t.score]}`;
      return [own, t.reason, below ? `${below} topic${below > 1 ? "s" : ""} inside` : ""].filter(Boolean).join(" · ");
    };

    const dots: Dot[] = [];
    const edges: { key: string; x1: number; y1: number; x2: number; y2: number; dashed: boolean }[] = [];
    const center = focus ? byId.get(focus) : undefined;

    if (center) {
      const r = radiusOf(m(center.id), 1.25);
      dots.push({
        key: center.id,
        kind: "center",
        x: 0,
        y: 0,
        r,
        fill: fillOf(m(center.id)),
        label: center.name,
        labelY: r + 22,
        title: center.name,
        detail: describe(center.id),
      });
    } else {
      dots.push({
        key: "__root",
        kind: "root",
        x: 0,
        y: 0,
        r: 7,
        fill: 0,
        label: "What you know",
        labelY: 26,
        title: "What you know",
        detail: "Click a field to look inside it",
      });
    }

    const kids = focus ? (children.get(focus) ?? []) : map.topics.filter((t) => !t.parent);
    const suggested = focus ? map.suggestions.filter((s) => s.near === focus) : [];
    const related = center
      ? [...new Set([...center.related, ...map.topics.filter((t) => t.related.includes(center.id)).map((t) => t.id)])]
          .map((id) => byId.get(id))
          .filter((t) => t !== undefined)
      : [];
    const count = kids.length + suggested.length + related.length;
    const place = (i: number) => {
      const angle = (i / Math.max(count, 1)) * 2 * Math.PI - Math.PI / 2;
      const ring = count > ONE_RING_MAX && i % 2 ? 0.62 : 1;
      return { angle, x: Math.cos(angle) * RX * ring, y: Math.sin(angle) * RY * ring };
    };

    kids.forEach((t, i) => {
      const { x, y, angle } = place(i);
      const r = radiusOf(m(t.id));
      const inner = children.get(t.id) ?? [];
      const hints = map.suggestions.filter((s) => s.near === t.id);
      const total = inner.length + hints.length;
      dots.push({
        key: t.id,
        kind: "child",
        x,
        y,
        r,
        fill: fillOf(m(t.id)),
        label: t.name,
        labelY: r + 18 + (total && y > 0 ? 12 : 0),
        title: t.name,
        detail: describe(t.id),
        onClick: () => onFocus(t.id),
      });
      edges.push({ key: `e-${t.id}`, x1: 0, y1: 0, x2: x, y2: y, dashed: false });
      // The dots inside fan out on the far side from the focus.
      const fan = Math.min(Math.PI * 0.9, total * 0.34);
      const place2 = (j: number) => {
        const a = angle + (total > 1 ? (j / (total - 1) - 0.5) * fan : 0);
        return { x: x + Math.cos(a) * (r + 11), y: y + Math.sin(a) * (r + 11) };
      };
      inner.forEach((g, j) => {
        dots.push({
          key: g.id,
          kind: "grand",
          ...place2(j),
          r: Math.min(6, 2.5 + Math.sqrt(m(g.id))),
          fill: Math.max(0.5, fillOf(m(g.id))),
          label: null,
          labelY: 0,
          title: g.name,
          detail: describe(g.id),
          onClick: () => onFocus(g.id),
        });
      });
      hints.forEach((s, j) => {
        dots.push({
          key: `s-${s.id}`,
          kind: "grand-suggestion",
          ...place2(inner.length + j),
          r: 3,
          fill: 0,
          label: null,
          labelY: 0,
          title: `Suggested: ${s.name}`,
          detail: s.reason,
          onClick: () => onSuggestion(s.id),
        });
      });
    });

    suggested.forEach((s, i) => {
      const { x, y } = place(kids.length + i);
      dots.push({
        key: `s-${s.id}`,
        kind: "suggestion",
        x,
        y,
        r: 13,
        fill: 0,
        label: s.name,
        labelY: 31,
        title: `Suggested: ${s.name}`,
        detail: s.reason,
        onClick: () => onSuggestion(s.id),
      });
      edges.push({ key: `e-s-${s.id}`, x1: 0, y1: 0, x2: x, y2: y, dashed: true });
    });

    related.forEach((t, i) => {
      const { x, y } = place(kids.length + suggested.length + i);
      const r = radiusOf(m(t.id));
      dots.push({
        key: t.id,
        kind: "related",
        x,
        y,
        r,
        fill: fillOf(m(t.id)),
        label: t.name,
        labelY: r + 18,
        title: `Related: ${t.name}`,
        detail: describe(t.id),
        onClick: () => onFocus(t.id),
      });
      edges.push({ key: `e-r-${t.id}`, x1: 0, y1: 0, x2: x, y2: y, dashed: true });
    });

    return { dots, edges };
  }, [map, focus, onFocus, onSuggestion]);

  return (
    <div className="map" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`${-W / 2} ${-H / 2} ${W} ${H}`} role="img" aria-label="Knowledge map">
        {/* Keyed by the focus, so the lines fade in again once the dots have moved. */}
        <g key={focus ?? "__root"} className="edges">
          {edges.map((e) => (
            <line key={e.key} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className={e.dashed ? "edge dashed" : "edge"} />
          ))}
        </g>
        {dots.map((d) => {
          const selected = d.key === `s-${selectedSuggestion}`;
          return (
            <g
              key={d.key}
              className={`dot ${d.kind} ${d.onClick ? "clickable" : ""} ${selected ? "selected" : ""}`}
              style={{ transform: `translate(${d.x}px, ${d.y}px)` }}
              role={d.onClick ? "button" : undefined}
              tabIndex={d.onClick ? 0 : undefined}
              aria-label={`${d.title}. ${d.detail}`}
              onClick={d.onClick}
              onKeyDown={(e) => {
                if (d.onClick && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  d.onClick();
                }
              }}
              onMouseMove={(e) => setHover({ dot: d, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
            >
              {/* A target bigger than the mark, so tiny dots are still easy to hit. */}
              <circle r={Math.max(d.r + 4, d.kind.startsWith("grand") ? 9 : 16)} className="hit" />
              <circle r={d.r} className="ring" />
              <circle r={d.r} className="body" style={{ fillOpacity: d.fill }} />
              {d.label && (
                <text y={d.labelY} textAnchor="middle" className="label">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <strong>{hover.dot.title}</strong>
          <div>{hover.dot.detail}</div>
        </div>
      )}
    </div>
  );
}
