async function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}
async function playSfx(name) {
    const path = Sfx[name]
    if (!path) {
        console.warn('Invalid sfx: ' + name)
        return
    }
    const sfx = new Audio(path);
    sfx.volume = .5
    await sfx.play();
}