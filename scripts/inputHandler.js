let targetInput = [];
const currentInput = [];
let keyListenerActive = false;

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

function setStratagemCode() {
    const children = [...board.children];
    children.forEach(child => board.removeChild(child));
    targetInput = getCurrentStratagemCode();
    for (const key of targetInput) {
        const boardItem = document.createElement("img");
        boardItem.src = Sprites.arrows[key];
        board.appendChild(boardItem);
    }
    wipeInput();
}