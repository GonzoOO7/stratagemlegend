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
    currentStratagems.shift();
    const screenItem = screen.children[0];
    screenItem.classList.add("completed");
    await sleep(250);
    screen.removeChild(screenItem);
    setStratagemCode();
    setKeyListenerActive();

}

function getCurrentStratagemCode() {
    const stratagem = currentStratagems[0];
    const code = stratagem ? stratagem.code : "";
    return code.split("");
}

async function startStratagemHandler() {
    return new Promise(resolve => {
        for (let i = 0; i < 10; i++) {
            const index = Math.floor(Math.random() * stratagems.length);
            addStratagem(stratagems[index].name);
        }
        setStratagemCode();
        setKeyListenerActive();
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