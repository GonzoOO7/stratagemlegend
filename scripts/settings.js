// Static configuration. Game data lives in assets/data/*.json and is loaded by data.js.

const sfxVolume = 0.25;

const Sfx = {
    correct: "/assets/sfx/stratagem finish.ogg",
    wrong: "/assets/sfx/arrow fail.ogg"
};

const Paths = {
    arrows: "/assets/icons/keys/",
    stratagems: "/assets/icons/stratagems/",
    categories: "/assets/icons/categories/"
};

const Sprites = {
    arrows: {
        w: Paths.arrows + "w.png",
        a: Paths.arrows + "a.png",
        s: Paths.arrows + "s.png",
        d: Paths.arrows + "d.png"
    }
};