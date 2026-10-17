// Ring chart of the stratagem tree, in the style of a disk usage analyzer -
// shared by the viewer page (tree.js) and the game (inputHandler.js).
// The focused folder is the hub in the middle, each ring outward is one level
// deeper, and every stratagem lands on the outer ring. Each node's angle is
// proportional to the number of stratagems below it.
//
// Wrapped in one namespace so none of these names collide with the game's
// own globals (pathKey, screen, ...).

const Wheel = (() => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const CENTER_R = 70;            // the hub, which doubles as the Back button
    const OUTER_R = 330;            // the wheel always fills the same disc
    const HUB_R = CENTER_R - 6;
    const START = -Math.PI / 2;     // 12 o'clock, going clockwise
    const FULL = Math.PI * 2;

    // Tint per top-level category, after the in-game stratagem colours.
    const HUE = {Mission: 45, Offensive: 0, Support: 205, Defensive: 120};

    const pathKey = path => path.join(">");

    function svgEl(tag, attrs, children) {
        const node = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
        for (const child of children || []) node.appendChild(child);
        return node;
    }

    // --- tree ----------------------------------------------------------------

    function build(node, path) {
        const here = [...path, node.name];
        const subs = (node.subcategories || []).map(sub => build(sub, here));
        const leaves = node.stratagemIds || [];
        const weight = leaves.length + subs.reduce((n, sub) => n + sub.weight, 0);
        return {name: node.name, path: here, subs, leaves, weight};
    }

    // The whole tree under one virtual root, from Data.roots.
    function buildRoot() {
        const subs = Data.roots.map(root => build(root, []));
        return {
            name: "Stratagem Legend", path: [], subs, leaves: [],
            weight: subs.reduce((n, sub) => n + sub.weight, 0)
        };
    }

    function depthOf(nodes) {
        return nodes.length ? 1 + Math.max(...nodes.map(n => depthOf(n.subs))) : 0;
    }

    // The node at `path`, or the root if the path leads nowhere.
    function find(root, path) {
        let node = root;
        for (const name of path) {
            node = node.subs.find(sub => sub.name === name);
            if (!node) return root;
        }
        return node;
    }

    function hueOf(path) {
        return HUE[path[0]] ?? 260;
    }

    // --- geometry ------------------------------------------------------------

    function point(r, a) {
        return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
    }

    // Annular sector between radii r0..r1 and angles a0..a1. A full turn has
    // to be drawn as two half arcs - an arc whose ends coincide draws nothing.
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

    // The square viewBox that shows the whole disc with a little margin.
    function viewBox() {
        const r = OUTER_R + 12;
        return `${-r} ${-r} ${2 * r} ${2 * r}`;
    }

    // --- fitting -------------------------------------------------------------

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

    // Largest icon that stays fully inside the cell, centred in it. Returns
    // null when not even a tiny one fits.
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

    // One line of hub text, shrunk until it fits across the circle at its height.
    function hubLine(y, s, cls, fontSize) {
        const text = s.toUpperCase();
        const room = 2 * Math.sqrt(Math.max(HUB_R * HUB_R - y * y, 0)) - 14;
        while (fontSize > 6 && textWidth(text, fontSize) > room) fontSize -= 0.5;
        const t = svgEl("text", {
            x: 0, y, "text-anchor": "middle", "font-size": fontSize, class: cls || ""
        });
        t.textContent = text;
        return t;
    }

    // --- rings ---------------------------------------------------------------

    // Draws every ring below `focus` into two fresh layers: `cells` (the
    // sectors) and `marks` (icons on top, so no sector paints over them). The
    // hub is left to the caller. Hooks, all optional:
    //   folder(node, group)      a folder cell was clicked
    //   stratagem(id, group)     a stratagem cell was clicked
    //   enter(info, event, group) / move(event) / leave()   hover
    // Every cell group carries `.info` ({path, weight} or {id, path}) and
    // `.icon` (its image, if one fitted), so callers can decorate them.
    function render(focus, hooks = {}) {
        const maxDepth = depthOf(focus.subs);
        // The stratagem ring gets wider when there are few stratagems (so
        // their cells stay roughly square); the category rings share the rest.
        const square = FULL * OUTER_R / focus.weight;
        const leafW = maxDepth ? Math.min(Math.max(square, 44), 110) : OUTER_R - CENTER_R;
        const leafR0 = OUTER_R - leafW;
        const ringW = maxDepth ? (leafR0 - CENTER_R) / maxDepth : 0;

        const cells = svgEl("g");
        const marks = svgEl("g");
        const folders = new Map();      // path key -> [folder group]
        const stratagems = [];          // stratagem groups, in drawing order
        let lit = [];

        function register(path, elm) {
            const key = pathKey(path);
            if (!folders.has(key)) folders.set(key, []);
            folders.get(key).push(elm);
        }

        // Hovering a cell lights every folder above it that is on screen:
        // hover Handheld and Weapon and Equipment light up too.
        function light(info) {
            unlight();
            for (let n = focus.path.length + 1; n <= info.path.length; n++) {
                for (const elm of folders.get(pathKey(info.path.slice(0, n))) || []) {
                    elm.classList.add("lit");
                    lit.push(elm);
                }
            }
        }

        function unlight() {
            for (const elm of lit) elm.classList.remove("lit");
            lit = [];
        }

        function cell(c) {
            const group = svgEl("g", {class: c.info.id ? "cell stratagem" : "cell folder"}, [
                svgEl("path", {d: sectorPath(c.r0, c.r1, c.a0, c.a1), fill: c.fill})
            ]);
            group.info = c.info;

            const fit = c.icon && fitIcon(c);
            if (fit) {
                group.icon = svgEl("image", {
                    href: c.icon, x: fit.x, y: fit.y, width: fit.size, height: fit.size
                });
                marks.appendChild(group.icon);
            }

            if (c.info.id) stratagems.push(group);
            else register(c.info.path, group);

            group.addEventListener("mouseenter", e => {
                light(c.info);
                if (hooks.enter) hooks.enter(c.info, e, group);
            });
            group.addEventListener("mousemove", e => {
                if (hooks.move) hooks.move(e);
            });
            group.addEventListener("mouseleave", () => {
                unlight();
                if (hooks.leave) hooks.leave();
            });
            group.addEventListener("click", () => {
                if (c.info.id) {
                    if (hooks.stratagem) hooks.stratagem(c.info.id, group);
                } else if (hooks.folder) {
                    hooks.folder(c.node, group);
                }
            });
            cells.appendChild(group);
        }

        function drawNode(node, depth, a0, a1, alt) {
            const r0 = CENTER_R + (depth - 1) * ringW;
            // A folder with nothing but stratagems reaches all the way out.
            const r1 = node.subs.length ? r0 + ringW : leafR0;
            const fill = shade(hueOf(node.path), depth, alt);
            cell({
                r0, r1, a0, a1, fill, node,
                info: {path: node.path, weight: node.weight},
                icon: Paths.categories + categoryIconPath(node.path),
                maxIcon: 57
            });
            drawChildren(node, depth, a0, a1, r1);
        }

        function drawChildren(node, depth, a0, a1, r1) {
            const per = (a1 - a0) / node.weight;
            let a = a0;
            node.subs.forEach((sub, i) => {
                const span = per * sub.weight;
                drawNode(sub, depth + 1, a, a + span, i % 2 === 1);
                a += span;
            });

            // A folder holding both subfolders and stratagems (Tesla Tower in
            // Emplacement): its stratagems stay in the outer ring with all the
            // others, and the gap between them and the folder is left open -
            // transparent, no empty panel.
            const hue = hueOf(node.path);
            node.leaves.forEach((id, i) => {
                cell({
                    r0: leafR0, r1: OUTER_R, a0: a + per * i, a1: a + per * (i + 1),
                    fill: shade(hue, maxDepth + 1, i % 2 === 1),
                    info: {id, path: node.path},
                    icon: stratagemIcon(id),
                    maxIcon: 57
                });
            });
        }

        drawChildren(focus, 0, START, START + FULL, CENTER_R);
        return {cells, marks, folders, stratagems, unlight};
    }

    // The hub for a folder: the Back tile. Root shows the title and sits dead
    // ("off"); any other folder shows the back icon, its name and size. The
    // caller attaches the click.
    function folderHub(node, atRoot) {
        const hub = svgEl("g", {class: atRoot ? "hub off" : "hub"}, [svgEl("circle", {r: HUB_R})]);
        if (atRoot) {
            hub.append(hubLine(-4, "Stratagem", "", 11), hubLine(10, "Legend", "", 11),
                       hubLine(26, `${Data.stratagems.length} codes`, "count", 8));
        } else {
            hub.append(
                svgEl("image", {href: Paths.ui + "back.png", x: -12, y: -40, width: 24, height: 24}),
                hubLine(2, node.name, "", 11),
                hubLine(16, `${node.weight} stratagems`, "count", 8),
                hubLine(34, "back", "hint", 7)
            );
        }
        return hub;
    }

    // --- tooltip -------------------------------------------------------------

    // The hover card for a cell, in the HTML element `tip`. With `codes` a
    // stratagem's card shows its arrow code; without, only icon, path and name
    // - the game must not hand over the answer.
    function tooltip(tip, {codes}) {
        function show(info, event) {
            let icon, name, extra = null;
            if (info.id) {
                const s = Data.byId[info.id];
                icon = stratagemIcon(info.id);
                name = (s.prefix ? s.prefix + " " : "") + s.name;
                if (codes) {
                    extra = el("div", "code", null,
                        [...s.code].map(k => el("img", "", {src: Sprites.arrows[k], alt: k})));
                }
            } else {
                icon = Paths.categories + categoryIconPath(info.path);
                name = info.path[info.path.length - 1];
                extra = el("div", "count", {textContent: `${info.weight} stratagems`});
            }
            const trail = info.id ? info.path : info.path.slice(0, -1);
            tip.replaceChildren(
                el("img", "icon", {src: icon, alt: ""}),
                el("div", "text", null, [
                    trail.length ? el("div", "path", {textContent: trail.join(" \u203a ")}) : null,
                    el("div", "name", {textContent: name}),
                    extra
                ])
            );
            tip.hidden = false;
            move(event);
        }

        function move(event) {
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

        function hide() {
            tip.hidden = true;
        }

        return {show, move, hide};
    }

    // --- zoom & pan ----------------------------------------------------------

    // Mouse wheel zooms around the cursor, dragging pans. A press only becomes
    // a pan once the mouse has moved a few pixels, so plain clicks still reach
    // the cells - and the click that ends a pan is flagged (`justDragged`) so
    // callers can ignore it. `onPanStart` runs when a pan begins.
    // minWidth: the narrowest view (deepest zoom), in SVG units.
    function zoomable(svg, {onPanStart, minWidth = 60} = {}) {
        let view = null;
        let press = null;
        let dragging = false;
        let justDragged = false;
        const full = 2 * (OUTER_R + 12);

        function setView(v) {
            view = v;
            svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.w}`);
        }

        function reset() {
            setView({x: -full / 2, y: -full / 2, w: full});
        }

        function toSvg(event) {
            const pt = svg.createSVGPoint();
            pt.x = event.clientX;
            pt.y = event.clientY;
            return pt.matrixTransform(svg.getScreenCTM().inverse());
        }

        svg.addEventListener("wheel", event => {
            event.preventDefault();
            const dy = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
            const w = Math.min(Math.max(view.w * Math.exp(dy * 0.0015), minWidth), full * 2);
            const k = w / view.w;
            const p = toSvg(event);
            setView({x: p.x - (p.x - view.x) * k, y: p.y - (p.y - view.y) * k, w});
        }, {passive: false});

        svg.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            press = {x: event.clientX, y: event.clientY};
            justDragged = false;
        });

        svg.addEventListener("pointermove", event => {
            if (!press) return;
            if (!dragging) {
                if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 5) return;
                dragging = true;
                svg.setPointerCapture(event.pointerId);
                svg.classList.add("dragging");
                if (onPanStart) onPanStart();
            }
            const scale = svg.getScreenCTM().a;
            setView({
                x: view.x - (event.clientX - press.x) / scale,
                y: view.y - (event.clientY - press.y) / scale,
                w: view.w
            });
            press = {x: event.clientX, y: event.clientY};
        });

        for (const type of ["pointerup", "pointercancel"]) {
            svg.addEventListener(type, () => {
                if (dragging) justDragged = true;
                press = null;
                dragging = false;
                svg.classList.remove("dragging");
            });
        }

        // Centre the view on (x, y), `w` units wide.
        function zoomTo(x, y, w) {
            w = Math.min(Math.max(w, minWidth), full * 2);
            setView({x: x - w / 2, y: y - w / 2, w});
        }

        reset();
        return {
            reset,
            zoomTo,
            get dragging() { return dragging; },
            get justDragged() { return justDragged; }
        };
    }

    return {
        CENTER_R, OUTER_R, HUB_R, FULL,
        pathKey, svgEl, buildRoot, find, hueOf, shade, sectorPath, viewBox,
        textWidth, hubLine, render, folderHub, tooltip, zoomable
    };
})();
