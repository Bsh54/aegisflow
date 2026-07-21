# AegisFlow — Design System (generated with UI/UX Pro Max)

Query used: *"institutional fintech compliance security firewall blockchain B2B trust dashboard"*
plus targeted searches (style/color/typography/landing/ux).

## Pattern
**Real-Time / Operations Landing** enriched with **Trust & Authority** elements:
1. Hero — product + live status preview
2. Key metrics / indicators (live counters)
3. How it works
4. Proof / trust signals (contract address, attestation, OFAC source)
5. CTA (Run a verification / Dashboard) — primary CTA in nav + after metrics

## Style
**Modern Dark (cinematic, Linear-like) × Accessible**
- Background: gradient `#0a0a0f → #020203` — **never pure #000**
- Cards: `#0a0a0c` elevated, radius **16px**, hairline border `rgba(255,255,255,0.08)`
- Subtle ambient glow blobs (opacity 0.08–0.12, blur 30–50px, slow drift; disabled under `prefers-reduced-motion`)
- Surface glass: `rgba(255,255,255,0.05)`

## Colors (tokens)
| Token | Value | Use |
|---|---|---|
| `--bg-deep` | `#020203` | page bottom gradient |
| `--bg-base` | `#0a0a0f` | page top gradient |
| `--bg-elevated` | `#0a0a0c` | cards |
| `--surface` | `rgba(255,255,255,0.05)` | glass panels |
| `--foreground` | `#EDEDEF` | main text |
| `--muted-fg` | `#8A8F98` | secondary text |
| `--border` | `rgba(255,255,255,0.08)` | hairlines |
| `--accent` | `#E0245E` (Flare pink) | CTA only — flat, no gradients |
| `--gold` | `#F59E0B` | trust highlights (sparingly) |
| `--status-clear` | `#2DD4A7` | CLEAR verdict |
| `--status-review` | `#F5A623` | REVIEW verdict |
| `--status-blocked` | `#FF4D5E` | BLOCKED verdict |

Status colors carry the data story (ops pattern: "status colors green/amber/red,
data-dense but scannable"). Accent reserved for CTAs.

**Avoid:** playful design, AI purple/pink *gradients*, pure black, emoji-as-icon.

## Typography
**IBM Plex Sans** (300–700) headings + body — "conveys trust; excellent for data".
**IBM Plex Mono** for addresses, hashes, verdict codes, terminal blocks.

## Motion & interaction
- Transitions 150–300ms, easing `cubic-bezier(0.16,1,0.3,1)`
- Hover states on everything clickable + `cursor-pointer`
- Focus rings 3–4px visible (WCAG), skip links, ARIA labels
- Loading: skeleton/spinner for anything > 300ms; explicit success/error states
- `prefers-reduced-motion` respected

## Components
- Icons: inline SVG (Lucide-style strokes), **no emojis**
- Tables: `overflow-x-auto` wrapper on mobile
- Touch targets ≥ 44×44px
- Breakpoints: 375 / 768 / 1024 / 1440

## Pre-delivery checklist
- [ ] No emojis as icons (SVG only)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast ≥ 4.5:1
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375 / 768 / 1024 / 1440
