// Tree navigation: renders the breadcrumb and the current folder's contents,
// and handles clicks on folder tiles (descend) and stratagem tiles (answer).

const screen = document.getElementById("screen");
const breadcrumb = document.getElementById("breadcrumb");

let currentPath = [];   // [] == root
let locked = false;     // true while the correct answer animation plays

function renderBreadcrumb() {
    breadcrumb.replaceChildren();

    const rootCrumb = el("span", "crumb root", {textContent: "Stratagem Legend"});
    rootCrumb.addEventListener("click", () => navigate([]));
    breadcrumb.appendChild(rootCrumb);

    let acc = [];
    for (const name of currentPath) {
        acc = [...acc, name];
        const target = [...acc];
        const sep = el("span", "sep", {textContent: "›"});
        const crumb = el("span", "crumb", {textContent: name});
        crumb.addEventListener("click", () => navigate(target));
        breadcrumb.append(sep, crumb);
    }
}

function renderScreen() {
    const node = nodeChildren(currentPath);
    screen.replaceChildren();

    const subcategories = nodeSubcategories(node);
    const stratagemIds = nodeStratagems(node);

    for (const sub of subcategories) {
        const childPath = [...currentPath, sub.name];
        const icon = categoryIconPath(childPath);
        const tile = el("div", "tile folder", {title: sub.name}, [
            el("img", "", {src: Paths.categories + icon, alt: ""}),
            el("span", "label", {textContent: sub.name})
        ]);
        tile.addEventListener("click", () => {
            if (!locked) navigate(childPath);
        });
        screen.appendChild(tile);
    }

    // Only worth drawing when the view actually holds both kinds.
    if (subcategories.length && stratagemIds.length) {
        screen.appendChild(el("div", "separator"));
    }

    for (const id of stratagemIds) {
        const stratagem = Data.byId[id];
        const label = (stratagem.prefix ? stratagem.prefix + " " : "") + stratagem.name;
        const tile = el("div", "tile stratagem", {title: stratagem.name}, [
            el("img", "", {src: stratagemIcon(id), alt: ""}),
            el("span", "label", {textContent: label})
        ]);
        tile.addEventListener("click", () => {
            if (!locked) answer(id, tile);
        });
        screen.appendChild(tile);
    }
}

function navigate(path) {
    currentPath = path;
    renderBreadcrumb();
    renderScreen();
}

function flash(tile, className, ms) {
    tile.classList.add(className);
    setTimeout(() => tile.classList.remove(className), ms);
}