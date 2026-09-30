// Loads the stratagem list, the category tree and the id->icon map, and exposes
// lookups for both icons and tree navigation.

const Data = {
    stratagems: [],   // [{id, name, prefix, code}]
    roots: [],        // top-level tree nodes
    byId: {},         // id -> stratagem
    pathOf: {},       // id -> [category names] to reach it (first occurrence)
    iconOf: {},       // id -> icon filename
    sharedIcons: new Set()  // ids whose icon is reused by another stratagem
};

async function loadData() {
    const [list, tree, icons] = await Promise.all([
        fetch("assets/data/stratagemList.json").then(r => r.json()),
        fetch("assets/data/stratagemTree.json").then(r => r.json()),
        fetch("assets/data/iconMap.json").then(r => r.json())
    ]);

    Data.stratagems = list;
    Data.roots = tree;
    Data.byId = Object.fromEntries(list.map(s => [s.id, s]));
    Data.iconOf = icons;
    Data.pathOf = indexPaths(tree);

    // An icon used by more than one stratagem makes those stratagems
    // indistinguishable in the grid, so their folder gets name labels.
    const usage = {};
    for (const [id, file] of Object.entries(icons)) {
        (usage[file] ||= []).push(id);
    }
    Data.sharedIcons = new Set(
        Object.values(usage).filter(ids => ids.length > 1).flat()
    );

    return Data;
}

// --- icons -------------------------------------------------------------------

function stratagemIcon(id) {
    const file = Data.iconOf[id];
    return file ? Paths.stratagems + file : null;
}

// Category icons follow <parent>_<node>.png, or <node>.png at the top level.
// Whitespace is dropped, so "Team reload" -> backpack_teamreload.png.
function categoryIcon(path) {
    const slug = name => name.toLowerCase().replace(/\s+/g, "");
    if (path.length === 1) return slug(path[0]) + ".png";
    return slug(path[path.length - 2]) + "_" + slug(path[path.length - 1]) + ".png";
}

function categoryIconPath(path) {
    // Vehicle has no icon of its own; it reuses the FRV one.
    if (path.length === 2 && path[1] === "Vehicle") return "vehicle_frv.png";
    return categoryIcon(path);
}

// --- tree --------------------------------------------------------------------

// A few stratagems appear in two places; the first path wins.
function indexPaths(roots) {
    const pathOf = {};

    function walk(nodes, path) {
        for (const node of nodes) {
            const here = [...path, node.name];
            for (const id of node.stratagemIds || []) {
                if (!(id in pathOf)) pathOf[id] = here;
            }
            if (node.subcategories) walk(node.subcategories, here);
        }
    }

    walk(roots, []);
    return pathOf;
}

// The current node is either the root (null) or a node with a `path` breadcrumb.
function nodeSubcategories(node) {
    return node ? node.subcategories || [] : Data.roots;
}

function nodeStratagems(node) {
    return node ? node.stratagemIds || [] : [];
}

function nodeChildren(path) {
    let nodes = Data.roots;
    let node = null;
    for (const name of path) {
        node = (nodes || []).find(n => n.name === name);
        if (!node) return null;
        nodes = node.subcategories;
    }
    return node;
}