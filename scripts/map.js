// The code map: every stratagem laid out by its arrow code. Start in the
// middle; each arrow moves in its direction, each shorter than the one before.
// Each arrow is half as long as the one before (1, 1/2, 1/4, ...). A slider
// turns the map (-45 degrees by default). The first arrow picks the region and each
// later one refines it, so codes that start alike end up close together. The
// way from the middle to an icon is its code: one curve per arrow, with the
// arrow drawn on it. Halves or faster keep every code on a spot of its own;
// slower ones let later arrows outweigh earlier ones, and regions mix.
//
// Hover an icon for its name and code (its way lights up), click it to zoom in
// on it, Escape to zoom back out. Wheel to zoom, drag to pan.

const svg = document.getElementById("map");
const tip = document.getElementById("tip");
const {svgEl} = Wheel;
const tips = Wheel.tooltip(tip, {codes: true});
// Deep zoom: the closest two (Maelstrom and Bastion, 9 arrows) sit under a
// unit apart.
const zoom = Wheel.zoomable(svg, {onPanStart: () => tips.hide(), minWidth: 3});

const FIT = 320;            // the farthest point of the map, in SVG units
const STORE = "stratagemlegend.map";

// Length of the n-th arrow (n from 1), first arrow = 1: halves.
const stepFn = n => 2 ** (1 - n);
const DEFAULT_TURN = -45;   // degrees, counter-clockwise

// The map's turn: the arrows' directions, turned. The arrows drawn on the
// curves and the icons stay upright - each arrow shows the key it stands for
// (turned pixel art would be unreadable).
let DIR = turned(DEFAULT_TURN);

function turned(degrees) {
    const t = degrees * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    const turn = ([x, y]) => [x * c - y * s, x * s + y * c];
    return {w: turn([0, -1]), s: turn([0, 1]), a: turn([-1, 0]), d: turn([1, 0])};
}

// Each curve bows to the left of its direction, so an arrow that turns back
// (right, then left) runs beside the one before instead of on top of it.
const BEND = 0.18;
const ICON = 0.8;           // icon size, as a share of the code's last arrow
const ICON_MAX = 34;

const edges = new Map();    // code prefix -> the curve leading to it
const parts = [];           // everything that fades on hover: {elm, code}
const turnSlider = document.getElementById("turn");
const turnText = document.getElementById("turn-label");

function shared(a, b) {
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n;
}

// Hovering a stratagem greys out everything else by how far it is from it:
// how many arrows of the hovered code it shares, from the start. A neighbour
// that differs only in the last arrow stays nearly lit, another region is
// almost gone. Its own way lights up white.
function light(code, on) {
    for (const {elm, code: other} of parts) {
        if (!on) {
            elm.style.opacity = "";
            elm.style.filter = "";
            continue;
        }
        const near = shared(code, other) / code.length;     // 1 = on the way
        elm.style.opacity = (0.08 + 0.92 * near ** 1.5).toFixed(3);
        elm.style.filter = near >= 1 ? "" : `grayscale(${(1 - near).toFixed(2)})`;
    }
    for (let n = 1; n <= code.length; n++) {
        const edge = edges.get(code.slice(0, n));
        if (!edge) continue;
        edge.classList.toggle("on", on);
        if (on) edge.parentNode.appendChild(edge);      // on top of the others
    }
}

// How much of each code is drawn: up to where its branch stops forking. From
// there on only that one stratagem is left, and the rest of its code would be
// a lone line - so its icon sits right there (the tooltip has the full code).
let drawnCode = {};         // id -> the drawn part of its code

function cutCodes() {
    const below = new Map();        // prefix -> how many stratagems start with it
    for (const s of Data.stratagems) {
        for (let n = 1; n <= s.code.length; n++) {
            const prefix = s.code.slice(0, n);
            below.set(prefix, (below.get(prefix) || 0) + 1);
        }
    }
    drawnCode = {};
    for (const s of Data.stratagems) {
        let n = 1;
        while (n < s.code.length && below.get(s.code.slice(0, n)) > 1) n++;
        drawnCode[s.id] = s.code.slice(0, n);
    }
}

// Scale so the farthest point of any code lands at FIT.
function unitFor(len) {
    let far = 0;
    for (const s of Data.stratagems) {
        let x = 0, y = 0, n = 1;
        for (const key of drawnCode[s.id]) {
            x += DIR[key][0] * len(n);
            y += DIR[key][1] * len(n);
            far = Math.max(far, Math.abs(x), Math.abs(y));
            n++;
        }
    }
    return FIT / far;
}

// The curve between two points, bowing to the left of the way from a to b,
// and the point halfway along it (where its arrows go).
function curveBetween(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return {
        d: `M${a.x} ${a.y} Q${mx + dy * BEND * 2} ${my - dx * BEND * 2} ${b.x} ${b.y}`,
        apex: {x: mx + dy * BEND, y: my - dx * BEND}
    };
}

function build() {
    edges.clear();
    parts.length = 0;
    tips.hide();
    cutCodes();
    const unit = unitFor(stepFn);
    const curves = svgEl("g", {class: "edges"});
    const arrows = svgEl("g", {class: "arrows"});
    const icons = svgEl("g", {class: "icons"});

    // Where every drawn prefix lands, the length of the arrow leading to it,
    // and what branches off it.
    const at = new Map([["", {x: 0, y: 0}]]);
    const stepTo = new Map();
    const kids = new Map();
    for (const s of Data.stratagems) {
        let x = 0, y = 0, prefix = "";
        [...drawnCode[s.id]].forEach((key, i) => {
            const step = unit * stepFn(i + 1);
            const parent = prefix;
            prefix += key;
            x += DIR[key][0] * step;
            y += DIR[key][1] * step;
            if (!at.has(prefix)) {
                at.set(prefix, {x, y});
                stepTo.set(prefix, step);
                if (!kids.has(parent)) kids.set(parent, new Set());
                kids.get(parent).add(prefix);
            }
        });
    }

    // A run of arrows without a fork is drawn as one curve, from the fork (or
    // the start) before it to the next fork or icon - forks and icons stay
    // where their codes put them, only the lone zigzag in between goes. Its
    // arrows sit side by side on it.
    const stop = prefix => prefix === "" || (kids.get(prefix)?.size ?? 0) !== 1;
    const drawn = new Set();
    for (const s of Data.stratagems) {
        const code = drawnCode[s.id];
        let from = "";
        for (let n = 1; n <= code.length; n++) {
            const to = code.slice(0, n);
            if (!stop(to)) continue;
            if (!drawn.has(to)) {
                drawn.add(to);
                const first = stepTo.get(code.slice(0, from.length + 1));
                const {d, apex} = curveBetween(at.get(from), at.get(to));
                const curve = svgEl("path", {class: "edge", d, "stroke-width": first * 0.025});
                curves.appendChild(curve);
                for (let k = from.length + 1; k <= to.length; k++) edges.set(code.slice(0, k), curve);
                parts.push({elm: curve, code: to});

                const keys = to.slice(from.length);
                const size = Math.min(first * 0.28, 26);
                const gap = size * 1.05;
                [...keys].forEach((key, i) => {
                    const ax = apex.x + (i - (keys.length - 1) / 2) * gap;
                    const arrow = svgEl("image", {
                        href: Sprites.arrows[key],
                        x: ax - size / 2, y: apex.y - size / 2, width: size, height: size
                    });
                    arrows.appendChild(arrow);
                    parts.push({elm: arrow, code: to});
                });
            }
            from = to;
        }
    }

    // Shorter codes last, so their bigger icons sit on top of deeper ones.
    const order = [...Data.stratagems].sort((a, b) => b.code.length - a.code.length);
    for (const s of order) {
        const code = drawnCode[s.id];
        const {x, y} = at.get(code);
        const size = Math.min(stepTo.get(code) * ICON, ICON_MAX);     // by the last arrow
        const icon = svgEl("image", {
            class: "strat", href: stratagemIcon(s.id),
            x: x - size / 2, y: y - size / 2, width: size, height: size
        });
        const info = {id: s.id, path: Data.pathOf[s.id] || []};
        icon.addEventListener("mouseenter", e => {
            light(s.code, true);
            if (!zoom.dragging) tips.show(info, e);
        });
        icon.addEventListener("mousemove", tips.move);
        icon.addEventListener("mouseleave", () => {
            light(s.code, false);
            tips.hide();
        });
        icon.addEventListener("click", () => {
            if (!zoom.justDragged) zoom.zoomTo(x, y, size * 9);
        });
        icons.appendChild(icon);
        parts.push({elm: icon, code: s.code});
    }

    const start = svgEl("circle", {class: "start", r: 5});
    svg.replaceChildren(svgEl("g", {class: "scene"}, [curves, arrows, start, icons]));
}

document.addEventListener("keydown", event => {
    if (event.key === "Escape") zoom.reset();
});

// --- the sliders ---------------------------------------------------------------

const prefs = {turn: DEFAULT_TURN};

function apply() {
    turnSlider.value = prefs.turn;
    turnText.textContent = `${Math.round(prefs.turn)}\u00b0`;
    DIR = turned(prefs.turn);
    try {
        localStorage.setItem(STORE, JSON.stringify(prefs));
    } catch {
        // storage blocked: the choice just won't survive a reload
    }
}

turnSlider.addEventListener("input", () => {
    prefs.turn = Number(turnSlider.value);
    apply();
    build();
});
// a double click puts it back to the default
turnSlider.addEventListener("dblclick", () => { prefs.turn = DEFAULT_TURN; apply(); build(); });

try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && Number.isFinite(saved.turn)) prefs.turn = Math.min(Math.max(saved.turn, -180), 180);
} catch {
    // unreadable or blocked storage: the default
}
apply();

loadData().then(build);
