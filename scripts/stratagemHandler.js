const currentStratagems = [];
const screenRoot = document.getElementById("screen");

function addStratagem(name) {
    const stratagem = stratagems.find(elem => elem.name === name);
    currentStratagems.push(stratagem);

    const screenItem = document.createElement("img");
    screenItem.src = `/assets/stratagem/${name}.png`;
    screenRoot.appendChild(screenItem);
}

function shiftStratagem() {
    currentStratagems.shift();
    const screenItem = screenRoot.children[0];
    screenRoot.removeChild(screenItem);
}

function getCurrentStratagemCode() {
    const code = currentStratagems[0].code;
    return code.split('');
}

function startStratagemHandler() {
    addStratagem("reinforce");
    addStratagem("super_earth_flag");
    addStratagem("sos");
    addStratagem("reinforce");
}