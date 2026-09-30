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