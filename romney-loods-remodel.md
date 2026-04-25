# romney-loods — current SVG code for remodeling in chat

Current bounding box after dev-tool adjustments: **x 537  y 480  w 271  h 70**  
The group carries `transform="translate(319, 292) scale(0.613, 0.407)"` — all coords below are in raw (pre-transform) space.

---

## Group wrapper

```svg
<g id="romney-loods" class="zone" transform="translate(319, 292) scale(0.613, 0.407)">
```
Raw origin: x 356, y 462.

---

## Drop shadow

```svg
<rect x="356" y="462" width="442" height="172" rx="2"
      fill="#080e04" opacity="0.2" transform="translate(5,5)"/>
```
Offset copy of the body rect for a soft drop-shadow.

---

## Body — two-layer fill

```svg
<rect x="356" y="462" width="442" height="172" fill="#3a6028"/>
<rect x="356" y="462" width="442" height="172" fill="#5a8840" opacity="0.6"/>
```

---

## Corrugated roof bands

```svg
<rect x="356" y="462" width="442" height="3"  fill="#2a4818"/>
<rect x="356" y="481" width="442" height="2"  fill="#2a4818" opacity="0.45"/>
<rect x="356" y="500" width="442" height="2"  fill="#2a4818" opacity="0.45"/>
<rect x="356" y="519" width="442" height="2"  fill="#2a4818" opacity="0.45"/>
<rect x="356" y="538" width="442" height="2"  fill="#2a4818" opacity="0.45"/>
<rect x="356" y="557" width="442" height="2"  fill="#2a4818" opacity="0.45"/>
<rect x="356" y="576" width="442" height="2"  fill="#2a4818" opacity="0.45"/>
<rect x="356" y="595" width="442" height="2"  fill="#2a4818" opacity="0.45"/>
<rect x="356" y="631" width="442" height="3"  fill="#2a4818"/>
```
Bands are 19px apart in raw space; y-scale (0.407) compresses them to ~8px on screen.

---

## Front opening (east end)

```svg
<rect x="768" y="470" width="30" height="156" fill="#182e10" opacity="0.88"/>
```
Dark void — open roller-door mouth.

---

## Label

```svg
<text x="577" y="546" class="label"
      text-anchor="middle" font-size="13"
      fill="rgba(195,238,170,0.78)">de romneyloods</text>
```

---

## Close

```svg
</g>
```
