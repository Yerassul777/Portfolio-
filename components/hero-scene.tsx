import type { CSSProperties } from "react"
import { GraduationCap, HeartHandshake, Medal, Trophy } from "lucide-react"
import { KZ_MAP } from "@/lib/kz-map"

// The four sections as floating 3D tiles. Where each sits is its slot's
// (globals.css "Home screen"); the tilt and the float's phase are its own.
const TILES = [
  { icon: Trophy, slot: "top-left", rx: "14deg", ry: "22deg", delay: "0s" },
  { icon: Medal, slot: "bottom-left", rx: "-10deg", ry: "28deg", delay: "-2.5s" },
  { icon: GraduationCap, slot: "top-right", rx: "12deg", ry: "-24deg", delay: "-1.2s" },
  { icon: HeartHandshake, slot: "bottom-right", rx: "-14deg", ry: "-20deg", delay: "-4s" },
]

/** Seconds between one city's light and the next: they never pulse together. */
const CITY_STAGGER = 0.73
/** One pulse of a city's light (globals.css). */
const CITY_PULSE = 4.8

/**
 * The home page's scene: Kazakhstan in glowing dots with its cities lighting
 * up one after another — opportunities all over the country — and the four
 * sections floating around it. On phones a band of its own under the search;
 * on wide screens it lies behind the heading. Decoration only.
 */
export function HeroScene() {
  return (
    <div aria-hidden="true" className="hero-scene">
      <div className="kz-map" style={{ "--map": `url(${KZ_MAP.src})`, aspectRatio: `${KZ_MAP.width} / ${KZ_MAP.height}` } as CSSProperties}>
        {KZ_MAP.cities.map((city, index) => (
          <i
            key={city.id}
            data-major={city.major || undefined}
            style={{ left: `${city.x}%`, top: `${city.y}%`, "--delay": `${-((index * CITY_STAGGER) % CITY_PULSE).toFixed(2)}s` } as CSSProperties}
          />
        ))}
      </div>
      {TILES.map(({ icon: Icon, slot, rx, ry, delay }) => (
        <span key={slot} className="hero-tile" data-slot={slot} style={{ "--rx": rx, "--ry": ry, "--delay": delay } as CSSProperties}>
          <Icon strokeWidth={1.75} />
        </span>
      ))}
    </div>
  )
}
