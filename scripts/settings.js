// Static configuration. Game data lives in assets/data/*.json and is loaded by data.js.

const sfxVolume = 0.25;

const Sfx = {
    click: "assets/sfx/arrow complete.ogg",
    correct: "assets/sfx/stratagem finish.ogg",
    wrong: "assets/sfx/arrow fail.ogg"
};

const Paths = {
    ui: "assets/icons/ui/",
    stratagems: "assets/icons/stratagems/",
    categories: "assets/icons/categories/"
};

const Sprites = {
    arrows: {
        w: Paths.ui + "w.png",
        a: Paths.ui + "a.png",
        s: Paths.ui + "s.png",
        d: Paths.ui + "d.png"
    }
};