let targetInput = [];
const currentInput = [];
let keyListenerActive = false;

const nameplate = document.getElementById('nameplate')
const board = document.getElementById("arrow-board");
addEventListener("keypress", handleKeyPress);

function handleKeyPress(keyEvent) {
    if (!keyListenerActive) {
        return;
    } else {
        keyListenerActive = false;
    }

    const key = keyEvent.key;
    if (!["w", "a", "s", "d"].includes(key)) {
        return;
    }

    addInput(key);
}

function addInput(key) {
    const currentIndex = currentInput.length;
    currentInput.push(key);
    let sfx;
    if (currentInput[currentIndex] === targetInput[currentIndex]) {
        sfx = "arrowComplete"
        processCorrectInput(currentIndex);
    } else {
        sfx = "arrowFail"
        processFailedInput(currentIndex);
    }
    playSfx(sfx)
}

async function processCorrectInput(currentIndex) {
    board.children[currentIndex].classList.add("completed");
    if (currentInput.length === targetInput.length) {
        shiftStratagem();
    } else {
        keyListenerActive = true
    }
}

async function processFailedInput(currentIndex) {
    function setAllArrowStates(add = true) {
        for (let i = 0; i <= currentIndex; i++) {
            const cl = board.children[i].classList;
            if (add) {
                cl.add("failed");
            } else {
                cl.remove("failed", "completed");
            }
        }
    }

    keyListenerActive = false;
    for (let i = 0; i < 4; i++) {
        setAllArrowStates(i % 2 === 0);
        await sleep(100);
    }
    wipeInput();
}

function wipeInput() {
    while (currentInput.length > 0) {
        currentInput.pop();
    }
    [...board.children].forEach(item => {
        item.classList.remove("completed", "failed");
    });
    keyListenerActive = true
}

function setStratagem() {
    const stratagem = getCurrentStratagem();
    // Name
    const text = document.createElement('h3')
    text.innerText = stratagem.name
    const nameplateChildren = [...nameplate.children];
    nameplateChildren.forEach(child => nameplate.removeChild(child));
    nameplate.appendChild(text)
    // Keys
    const boardChildren = [...board.children];
    boardChildren.forEach(child => board.removeChild(child));
    targetInput = stratagem.code
    for (const key of targetInput) {
        const boardItem = document.createElement("img");
        boardItem.src = Sprites.arrows[key];
        board.appendChild(boardItem);
    }
    wipeInput();
}