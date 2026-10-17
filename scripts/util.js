async function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

async function playSfx(name) {
    const path = Sfx[name];
    if (!path) {
        console.warn('Invalid sfx: ' + name);
        return;
    }
    const sfx = new Audio(path);
    sfx.volume = sfxVolume;
    await sfx.play();
}

// Terse element builder: el("div", "tile", {title: "x"}, [child, ...])
function el(tag, className, props, children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (props) Object.assign(node, props);
    for (const child of children || []) {
        if (child === null || child === undefined) continue;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
}

function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

// Fisher-Yates, in place.
function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

// --- blank icons ---------------------------------------------------------------

// Some icons are only the empty frame, no art yet (the top-level categories,
// the back icon). They are hidden wherever they would be drawn - the cell or
// row stays, just without the empty frame. Checked once per file: nothing
// inside the frame (3px in from the edge) means blank, so an icon that gets
// drawn later simply shows up.
const blankIcons = new Map();   // src -> Promise<boolean>

function isBlankIcon(src) {
    if (!blankIcons.has(src)) {
        blankIcons.set(src, new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const w = img.naturalWidth, h = img.naturalHeight;
                if (w < 8 || h < 8) return resolve(false);
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                const {data} = ctx.getImageData(3, 3, w - 6, h - 6);
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i]) return resolve(false);
                }
                resolve(true);
            };
            img.onerror = () => resolve(false);
            img.src = src;
        }));
    }
    return blankIcons.get(src);
}

// Hide the blank icons among the <img> / SVG <image> elements inside `scope`:
// an <img> drops out of its row (the name moves up to the front), an SVG
// <image> on the wheel just isn't drawn.
function hideBlankIcons(scope) {
    for (const elm of scope.querySelectorAll("img, image")) {
        const src = elm.getAttribute("src") || elm.getAttribute("href");
        if (!src) continue;
        isBlankIcon(src).then(blank => {
            if (!blank) return;
            if (elm.tagName.toLowerCase() === "img") elm.style.display = "none";
            else elm.style.visibility = "hidden";
        });
    }
}

