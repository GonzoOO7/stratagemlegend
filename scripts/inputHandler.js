let targetInput = [];
const currentInput = [];

const board = document.getElementById("arrow-board");

function handleKeyPress(keyEvent) {
    const key = keyEvent.key;
    if (!["w", "a", "s", "d"].includes(key)) {
        return;
    }
    addInput(key);
}

function addInput(key) {
    const currentIndex = currentInput.length;
    currentInput.push(key);
    if (currentInput[currentIndex] === targetInput[currentIndex]) {
        processCorrectInput(currentIndex);
    } else {
        processFailedInput(currentIndex);
    }
}

function processCorrectInput(currentIndex) {
    board.children[currentIndex].classList.add("completed");
    if (currentInput.length === targetInput.length) {
        setKeyListenerActive(false);
        shiftStratagem();
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

    setKeyListenerActive(false);
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
    setKeyListenerActive();
}

function setKeyListenerActive(active = true) {
    if (active) {
        addEventListener("keypress", handleKeyPress);
    } else {
        removeEventListener("keypress", handleKeyPress);
    }
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