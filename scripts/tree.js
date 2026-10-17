// Radial view of the stratagem tree, in the style of a disk usage analyzer:
// the focused folder sits in the middle, each ring outward is one level deeper,
// and every stratagem lands on the outer ring. Click a folder to make it the
// centre; click the centre (or press Backspace / Escape) to go back up.
// Hover for details, wheel to zoom, drag to pan.

const SVG_NS = "http://www.w3.org/2000/svg";
const wheel = document.getElementById("wheel");
const tip = document.getElementById("tip");
const crumbs = document.getElementById("crumbs");

const CENTER_R = 70;            // the hub, which doubles as the Back button
const OUTER_R = 330;            // the wheel always fills the same disc
const START = -Math.PI / 2;     // 12 o'clock, going clockwise
const FULL = Math.PI * 2;

// Tint per top-level category, after the in-game stratagem colours.
const HUE = {Mission: 45, Offensive: 0, Support: 205, Defensive: 120};

let rootNode = null;
let focus = null;

// Folder sectors (and their fillers) by path, so hovering anything can light up
// the folders it sits in. Rebuilt on every draw.
let folderCells = new Map();
let litCells = [];

// Ring geometry, recomputed for every focus.
let leafR0 = 0;
let ringW = 0;
let maxDepth = 0;

function svgEl(tag, attrs, children) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
    for (const child of children || []) node.appendChild(child);
    return node;
}

// --- tree --------------------------------------------------------------------

// Every node's angle is proportional to the number of stratagems below it.
function build(node, path) {
    const here = [...path, node.name];
    const subs = (node.subcategories || []).map(sub => build(sub, here));
    const leaves = node.stratagemIds || [];
    const weight = leaves.length + subs.reduce((n, sub) => n + sub.weight, 0);
    return {name: node.name, path: here, subs, leaves, weight};
}

function depthOf(nodes) {
    return nodes.length ? 1 + Math.max(...nodes.map(n => depthOf(n.subs))) : 0;
}

function find(path) {
    let node = rootNode;
    for (const name of path) {
        node = node.subs.find(sub => sub.name === name);
        if (!node) return rootNode;
    }
    return node;
}

function hueOf(path) {
    return HUE[path[0]] ?? 260;
}

// --- geometry ----------------------------------------------------------------

// The wheel keeps its size whatever is in focus: the stratagem ring gets wider
// when there are few stratagems (so their cells stay roughly square), and the
// category rings share whatever is left between it and the hub.
function layout() {
    maxDepth = depthOf(focus.subs);
    const square = FULL * OUTER_R / focus.weight;
    const leafW = maxDepth ? Math.min(Math.max(square, 44), 110) : OUTER_R - CENTER_R;
    leafR0 = OUTER_R - leafW;
    ringW = maxDepth ? (leafR0 - CENTER_R) / maxDepth : 0;
}

function point(r, a) {
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
}

// Annular sector between radii r0..r1 and angles a0..a1. A full turn has to
// be drawn as two half arcs - an arc whose ends coincide draws nothing.
function sectorPath(r0, r1, a0, a1) {
    if (a1 - a0 > FULL - 1e-6) {
        const m = a0 + Math.PI;
        return `M${point(r1, a0)} A${r1} ${r1} 0 1 1 ${point(r1, m)} `
             + `A${r1} ${r1} 0 1 1 ${point(r1, a0)} Z `
             + `M${point(r0, a0)} A${r0} ${r0} 0 1 0 ${point(r0, m)} `
             + `A${r0} ${r0} 0 1 0 ${point(r0, a0)} Z`;
    }
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${point(r0, a0)} L${point(r1, a0)} `
         + `A${r1} ${r1} 0 ${large} 1 ${point(r1, a1)} `
         + `L${point(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${point(r0, a0)} Z`;
}

function shade(hue, depth, alt) {
    const light = 25 - depth * 1.5 + (alt ? 4 : 0);
    return `hsl(${hue} 35% ${light}%)`;
}

// --- drawing -----------------------------------------------------------------

// --- fitting -----------------------------------------------------------------

const measureCtx = document.createElement("canvas").getContext("2d");

function textWidth(text, fontSize) {
    measureCtx.font = `${fontSize}px HD, sans-serif`;
    return measureCtx.measureText(text).width;
}

// Is every point of the rectangle inside the annular sector, keeping `pad`
// clear of all four edges? Straight boxes in curved cells: test points all
// along the edges, since the inner arc can bulge into the middle of one.
function boxFits(box, c, pad) {
    const fullTurn = c.a1 - c.a0 > FULL - 1e-6;
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
        const fx = box.x0 + (box.x1 - box.x0) * i / steps;
        const fy = box.y0 + (box.y1 - box.y0) * i / steps;
        for (const [x, y] of [[fx, box.y0], [fx, box.y1], [box.x0, fy], [box.x1, fy]]) {
            const r = Math.hypot(x, y);
            if (r < c.r0 + pad || r > c.r1 - pad) return false;
            if (fullTurn) continue;
            let a = Math.atan2(y, x);
            while (a < c.a0) a += FULL;
            while (a >= c.a0 + FULL) a -= FULL;
            const margin = pad / r;
            if (a < c.a0 + margin || a > c.a1 - margin) return false;
        }
    }
    return true;
}

// Largest icon that stays fully inside the cell, centred in it. Returns null
// when not even a tiny one fits.
function fitIcon(c) {
    const rm = (c.r0 + c.r1) / 2;
    const am = (c.a0 + c.a1) / 2;
    const cx = rm * Math.cos(am);
    const cy = rm * Math.sin(am);
    const depth = c.r1 - c.r0;
    const arc = rm * Math.min(c.a1 - c.a0, Math.PI);
    const pad = Math.min(3, depth * 0.06, arc * 0.06);

    for (let size = Math.min(c.maxIcon, depth * 0.85); size >= 6; size *= 0.92) {
        const box = {x0: cx - size / 2, y0: cy - size / 2, x1: cx + size / 2, y1: cy + size / 2};
        if (boxFits(box, c, pad)) return {x: box.x0, y: box.y0, size};
    }
    return null;
}

// --- cells -------------------------------------------------------------------

// One cell: the sector and its icon. Icons go on a separate layer above all
// sectors and are sized to stay inside their own cell. Names live in the
// tooltip only - the wheel itself carries no text.
function cell(layers, c) {
    const group = svgEl("g", {class: c.onClick ? "cell folder" : "cell"}, [
        svgEl("path", {d: sectorPath(c.r0, c.r1, c.a0, c.a1), fill: c.fill})
    ]);

    const fit = c.icon && fitIcon(c);
    if (fit) {
        layers.marks.appendChild(svgEl("image", {
            href: c.icon, x: fit.x, y: fit.y, width: fit.size, height: fit.size
        }));
    }

    if (!c.info.id) registerFolder(c.info.path, group);

    group.addEventListener("mouseenter", e => {
        lightAncestors(c.info);
        showTip(c.info, e);
    });
    group.addEventListener("mousemove", moveTip);
    group.addEventListener("mouseleave", () => {
        clearLit();
        hideTip();
    });
    if (c.onClick) {
        group.addEventListener("click", () => {
            if (!justDragged) c.onClick();
        });
    }
    layers.cells.appendChild(group);
}

function drawNode(layers, node, depth, a0, a1, alt) {
    const r0 = CENTER_R + (depth - 1) * ringW;
    // A folder with nothing but stratagems reaches all the way out to them.
    const r1 = node.subs.length ? r0 + ringW : leafR0;
    const fill = shade(hueOf(node.path), depth, alt);

    cell(layers, {
        r0, r1, a0, a1, fill,
        info: {path: node.path, weight: node.weight},
        icon: Paths.categories + categoryIconPath(node.path),
        maxIcon: 57,
        onClick: () => focusOn(node.path)
    });
    drawChildren(layers, node, depth, a0, a1, r1, fill);
}

function drawChildren(layers, node, depth, a0, a1, r1, fill) {
    const per = (a1 - a0) / node.weight;
    let a = a0;
    node.subs.forEach((sub, i) => {
        const span = per * sub.weight;
        drawNode(layers, sub, depth + 1, a, a + span, i % 2 === 1);
        a += span;
    });

    // A folder holding both subfolders and stratagems: carry it out to the
    // leaf ring above its own stratagems so they still touch their parent.
    if (node.leaves.length && r1 < leafR0) {
        const filler = svgEl("path", {
            d: sectorPath(r1, leafR0, a, a1), fill, class: "filler"
        });
        registerFolder(node.path, filler);
        layers.cells.appendChild(filler);
    }

    const hue = hueOf(node.path);
    node.leaves.forEach((id, i) => {
        cell(layers, {
            r0: leafR0, r1: OUTER_R, a0: a + per * i, a1: a + per * (i + 1),
            fill: shade(hue, maxDepth + 1, i % 2 === 1),
            info: {id, path: node.path},
            icon: stratagemIcon(id),
            maxIcon: 57
        });
    });
}

// The hub is the current folder, and clicking it goes one level up - the
// wheel's "Back" tile. At the very top there is nowhere to go.
function drawHub(layers) {
    const atRoot = focus === rootNode;
    const hubR = CENTER_R - 6;
    // Each line shrinks until it fits across the circle at its height.
    const line = (y, s, cls, fontSize) => {
        const text = s.toUpperCase();
        const room = 2 * Math.sqrt(Math.max(hubR * hubR - y * y, 0)) - 14;
        while (fontSize > 6 && textWidth(text, fontSize) > room) fontSize -= 0.5;
        const t = svgEl("text", {
            x: 0, y, "text-anchor": "middle", "font-size": fontSize, class: cls || ""
        });
        t.textContent = text;
        return t;
    };

    const hub = svgEl("g", {class: atRoot ? "hub off" : "hub"}, [
        svgEl("circle", {r: hubR})
    ]);

    if (atRoot) {
        hub.append(line(-4, "Stratagem", "", 11), line(10, "Legend", "", 11),
                   line(26, `${Data.stratagems.length} codes`, "count", 8));
    } else {
        hub.append(
            svgEl("image", {href: Paths.ui + "back.png", x: -12, y: -40, width: 24, height: 24}),
            line(2, focus.name, "", 11),
            line(16, `${focus.weight} stratagems`, "count", 8),
            line(34, "back", "hint", 7)
        );
        hub.addEventListener("click", () => {
            if (!justDragged) goUp();
        });
    }
    layers.marks.appendChild(hub);
}

function drawCrumbs() {
    crumbs.replaceChildren();
    const trail = [{name: "Stratagem Legend", path: []}];
    focus.path.forEach((name, i) => trail.push({name, path: focus.path.slice(0, i + 1)}));
    trail.forEach((step, i) => {
        if (i) crumbs.appendChild(el("span", "sep", {textContent: "›"}));
        const crumb = el("span", "crumb", {textContent: step.name});
        if (i < trail.length - 1) crumb.addEventListener("click", () => focusOn(step.path));
        crumbs.appendChild(crumb);
    });
}

// --- ancestor highlight ------------------------------------------------------

const pathKey = path => path.join(">");

function registerFolder(path, elm) {
    const key = pathKey(path);
    if (!folderCells.has(key)) folderCells.set(key, []);
    folderCells.get(key).push(elm);
}

// Hovering a cell lights every folder above it that is on screen: hover
// Handheld and Weapon and Equipment light up too; hover a stratagem and its
// folder chain does. The hovered cell itself keeps its stronger :hover look.
function lightAncestors(info) {
    clearLit();
    for (let n = focus.path.length + 1; n <= info.path.length; n++) {
        for (const elm of folderCells.get(pathKey(info.path.slice(0, n))) || []) {
            elm.classList.add("lit");
            litCells.push(elm);
        }
    }
}

function clearLit() {
    for (const elm of litCells) elm.classList.remove("lit");
    litCells = [];
}

function draw() {
    layout();
    folderCells = new Map();
    litCells = [];
    const layers = {cells: svgEl("g"), marks: svgEl("g")};
    const fill = shade(hueOf(focus.path), 0, false);
    drawChildren(layers, focus, 0, START, START + FULL, CENTER_R, fill);
    drawHub(layers);

    const scene = svgEl("g", {class: "scene"}, [layers.cells, layers.marks]);
    wheel.replaceChildren(scene);
    drawCrumbs();
    resetView();
}

// --- navigation --------------------------------------------------------------

function focusOn(path) {
    const next = find(path);
    if (next === focus) return;
    focus = next;
    hideTip();
    playSfx("click").catch(() => {});
    draw();
}

function goUp() {
    if (focus.path.length) focusOn(focus.path.slice(0, -1));
}

document.addEventListener("keydown", event => {
    if (event.key === "Backspace" || event.key === "Escape") {
        event.preventDefault();
        goUp();
    }
});

// --- tooltip -----------------------------------------------------------------

function showTip(info, event) {
    if (dragging) return;
    let icon, name, extra;
    if (info.id) {
        const s = Data.byId[info.id];
        icon = stratagemIcon(info.id);
        name = (s.prefix ? s.prefix + " " : "") + s.name;
        extra = el("div", "code", null,
            [...s.code].map(k => el("img", "", {src: Sprites.arrows[k], alt: k})));
    } else {
        icon = Paths.categories + categoryIconPath(info.path);
        name = info.path[info.path.length - 1];
        extra = el("div", "count", {textContent: `${info.weight} stratagems`});
    }
    const trail = info.id ? info.path : info.path.slice(0, -1);
    tip.replaceChildren(
        el("img", "icon", {src: icon, alt: ""}),
        el("div", "text", null, [
            trail.length ? el("div", "path", {textContent: trail.join(" › ")}) : null,
            el("div", "name", {textContent: name}),
            extra
        ])
    );
    tip.hidden = false;
    moveTip(event);
}

function moveTip(event) {
    if (tip.hidden) return;
    const pad = 16;
    const {offsetWidth: w, offsetHeight: h} = tip;
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + w > innerWidth) x = event.clientX - w - pad;
    if (y + h > innerHeight) y = event.clientY - h - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
}

function hideTip() {
    tip.hidden = true;
}

// --- zoom & pan --------------------------------------------------------------

let view = null;
let press = null;           // where the button went down
let dragging = false;       // moved far enough to count as a pan
let justDragged = false;    // swallow the click that ends a pan

function setView(v) {
    view = v;
    wheel.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.w}`);
}

function resetView() {
    const r = OUTER_R + 12;
    setView({x: -r, y: -r, w: 2 * r});
}

function toSvg(event) {
    const pt = wheel.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    return pt.matrixTransform(wheel.getScreenCTM().inverse());
}

wheel.addEventListener("wheel", event => {
    event.preventDefault();
    const dy = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
    const full = 2 * (OUTER_R + 12);
    const w = Math.min(Math.max(view.w * Math.exp(dy * 0.0015), 60), full * 2);
    const k = w / view.w;
    const p = toSvg(event);
    setView({x: p.x - (p.x - view.x) * k, y: p.y - (p.y - view.y) * k, w});
}, {passive: false});

// A press only becomes a pan once the mouse has moved a few pixels, so plain
// clicks still reach the cells.
wheel.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    press = {x: event.clientX, y: event.clientY};
    justDragged = false;
});

wheel.addEventListener("pointermove", event => {
    if (!press) return;
    if (!dragging) {
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
        dragging = true;
        wheel.setPointerCapture(event.pointerId);
        wheel.classList.add("dragging");
        hideTip();
    }
    const scale = wheel.getScreenCTM().a;
    setView({
        x: view.x - (event.clientX - press.x) / scale,
        y: view.y - (event.clientY - press.y) / scale,
        w: view.w
    });
    press = {x: event.clientX, y: event.clientY};
});

for (const type of ["pointerup", "pointercancel"]) {
    wheel.addEventListener(type, () => {
        if (dragging) justDragged = true;
        press = null;
        dragging = false;
        wheel.classList.remove("dragging");
    });
}

// Labels are fitted by measuring them, so the font has to be in first.
Promise.all([loadData(), document.fonts.load("12px HD")]).then(() => {
    const subs = Data.roots.map(root => build(root, []));
    rootNode = {
        name: "Stratagem Legend", path: [], subs, leaves: [],
        weight: subs.reduce((n, sub) => n + sub.weight, 0)
    };
    focus = rootNode;
    draw();
});
