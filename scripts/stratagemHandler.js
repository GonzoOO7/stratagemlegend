const currentStratagems = [];
const screen = document.getElementById("screen");

function addStratagem(name) {
    const stratagem = stratagems.find(elem => elem.name === name);
    currentStratagems.push(stratagem);

    const screenItem = document.createElement("img");
    screenItem.src = `/assets/stratagem/${stratagem.img}.png`;
    screenItem.alt = stratagem.name;
    screen.appendChild(screenItem);
}

async function shiftStratagem() {
    await sleep(100);
    const screenItem = screen.children[0];
    screenItem.classList.add("completed");
    currentStratagems.shift();
    playSfx("stratagemComplete");
    await sleep(250);
    screen.removeChild(screenItem);
    setStratagem();
    if (currentStratagems.length > 0) {
        keyListenerActive = true;
    }
}

function getCurrentStratagem() {
    const stratagem = {...currentStratagems[0]};
    if (stratagem) {
        stratagem.code = stratagem.code.split("");
    }
    return stratagem;
}

async function startStratagemHandler() {
    return new Promise(resolve => {
        for (let i = 0; i < 10; i++) {
            const index = Math.floor(Math.random() * stratagems.length);
            addStratagem(stratagems[index].name);
        }
        setStratagem();
        keyListenerActive = true;
        checkCompletion();

        function checkCompletion() {
            if (currentStratagems.length === 0) {
                resolve();
            } else {
                setTimeout(checkCompletion, 100);
            }
        }
    });
}