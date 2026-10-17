// The viewer page: the stratagem ring chart (wheel.js) as a reference. Click a
// folder to make it the centre, click a stratagem to dive into it, click the
// centre (or press Backspace / Escape) to go back. Hover for details, wheel to
// zoom, drag to pan.

const wheel = document.getElementById("wheel");
const tip = document.getElementById("tip");
const crumbs = document.getElementById("crumbs");
const {svgEl, hubLine, HUB_R} = Wheel;
const tips = Wheel.tooltip(tip, {codes: true});
const zoom = Wheel.zoomable(wheel, {onPanStart: () => tips.hide()});

let rootNode = null;
let focus = null;
let drawn = null;           // what Wheel.render returned for the current folder

// The stratagem dived into: the rings are gone and the hub, blown up, shows
// it alone. Its folder stays in `focus`, so going back lands right there.
let selected = null;        // stratagem id
const DIVE_SCALE = 3;       // hub size when it holds a stratagem
const DIVE_MS = 300;

// --- hub ---------------------------------------------------------------------

// A stratagem's name: one line if it reads at 8px or more, otherwise split
// into the two most even halves. Returns the lines and where the next row goes.
function hubName(name, y) {
    const one = hubLine(y + 6, name, "", 10);
    if (Number(one.getAttribute("font-size")) >= 8 || !name.includes(" ")) {
        return {lines: [one], below: y + 13};
    }
    const words = name.split(" ");
    let best = null;
    for (let i = 1; i < words.length; i++) {
        const halves = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
        const width = Math.max(...halves.map(h => h.length));
        if (!best || width < best.width) best = {width, halves};
    }
    return {
        lines: [hubLine(y, best.halves[0], "", 9), hubLine(y + 10, best.halves[1], "", 9)],
        below: y + 15
    };
}

// The hub shows the stratagem dived into, otherwise the current folder.
// Clicking it goes back: out of the stratagem to its folder, or one level up -
// the wheel's "Back" tile. At the very top there is nowhere to go.
function buildHub() {
    const atRoot = focus === rootNode;
    let hub;
    if (selected) {
        // A stratagem has the whole wheel to itself: draw the hub blown up.
        const s = Data.byId[selected];
        const content = svgEl("g", {transform: `scale(${DIVE_SCALE})`}, [svgEl("circle", {r: HUB_R})]);
        hub = svgEl("g", {class: "hub"}, [content]);
        content.append(svgEl("image", {
            href: stratagemIcon(s.id), x: -17, y: -52, width: 34, height: 34
        }));
        if (s.prefix) content.append(hubLine(-8, s.prefix, "prefix", 7));
        const name = hubName(s.name, 0);
        content.append(...name.lines);

        const keys = [...s.code];
        const room = 2 * Math.sqrt(HUB_R * HUB_R - (name.below + 12) ** 2) - 14;
        const size = Math.min(12, room / keys.length - 1);
        const left = -(keys.length * (size + 1) - 1) / 2;
        keys.forEach((k, i) => content.append(svgEl("image", {
            href: Sprites.arrows[k], x: left + i * (size + 1), y: name.below, width: size, height: size
        })));
        content.append(hubLine(48, "back", "hint", 7));
    } else {
        hub = Wheel.folderHub(focus, atRoot);
    }

    if (selected || !atRoot) {
        hub.addEventListener("click", () => {
            if (!zoom.justDragged) back();
        });
    }
    return hub;
}

function drawCrumbs() {
    crumbs.replaceChildren();
    const trail = [{name: "Stratagem Legend", path: []}];
    focus.path.forEach((name, i) => trail.push({name, path: focus.path.slice(0, i + 1)}));
    if (selected) trail.push({name: Data.byId[selected].name, path: null});
    trail.forEach((step, i) => {
        if (i) crumbs.appendChild(el("span", "sep", {textContent: "›"}));
        const crumb = el("span", "crumb", {textContent: step.name});
        if (i < trail.length - 1) crumb.addEventListener("click", () => focusOn(step.path));
        crumbs.appendChild(crumb);
    });
}

function draw() {
    tips.hide();
    let scene;
    if (selected) {
        drawn = null;
        scene = svgEl("g", {class: "scene"}, [buildHub()]);
    } else {
        drawn = Wheel.render(focus, {
            folder: node => {
                if (!zoom.justDragged) focusOn(node.path);
            },
            stratagem: (id, group) => {
                if (!zoom.justDragged) dive(id, group);
            },
            enter: (info, event) => {
                if (!zoom.dragging) tips.show(info, event);
            },
            move: tips.move,
            leave: tips.hide
        });
        drawn.marks.appendChild(buildHub());
        scene = svgEl("g", {class: "scene"}, [drawn.cells, drawn.marks]);
    }
    const old = wheel.querySelector(".scene");
    wheel.replaceChildren(...(old && old.classList.contains("leaving") ? [old] : []), scene);
    hideBlankIcons(scene);
    drawCrumbs();
    zoom.reset();
}

// Clicking a stratagem dives into it: the wheel zooms in towards that cell and
// fades away, and the hub comes back holding just the stratagem.
function dive(id, group) {
    const old = wheel.querySelector(".scene");
    const box = group.getBBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    old.classList.add("leaving");
    const t0 = performance.now();
    (function frame(now) {
        const t = Math.min((now - t0) / DIVE_MS, 1);
        const k = 1 + (DIVE_SCALE * 2 - 1) * t * t;
        old.setAttribute("transform", `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`);
        old.style.opacity = 1 - t;
        if (t < 1) requestAnimationFrame(frame);
        else old.remove();
    })(t0);

    if (drawn) drawn.unlight();
    selected = id;
    playSfx("click").catch(() => {});
    draw();
}

// --- navigation --------------------------------------------------------------

function focusOn(path) {
    const next = Wheel.find(rootNode, path);
    if (next === focus && !selected) return;
    focus = next;
    selected = null;
    playSfx("click").catch(() => {});
    draw();
}

function goUp() {
    if (focus.path.length) focusOn(focus.path.slice(0, -1));
}

// The hub's click: out of the stratagem back to its folder, or up a level.
function back() {
    if (selected) {
        selected = null;
        playSfx("click").catch(() => {});
        draw();
    } else {
        goUp();
    }
}

document.addEventListener("keydown", event => {
    if (event.key === "Backspace" || event.key === "Escape") {
        event.preventDefault();
        back();
    }
});

// Hub text is fitted by measuring it, so the font has to be in first.
Promise.all([loadData(), document.fonts.load("12px HD")]).then(() => {
    rootNode = Wheel.buildRoot();
    focus = rootNode;
    draw();
});
