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
        // correct
        board.children[currentIndex].classList.add("correct");
        if (currentInput.length === targetInput.length) {
            setKeyListenerActive(false);
            setTimeout(() => {
                shiftStratagem();
                setStratagemCode();
                setKeyListenerActive();
            }, 200);
        }

    } else {
        // incorrect
        board.children[currentIndex].classList.add("incorrect");
        setKeyListenerActive(false);
        setTimeout(() => {
            wipeInput();
            setKeyListenerActive();
        }, 200);
    }
}

function wipeInput() {
    while (currentInput.length > 0) {
        currentInput.pop();
    }
    [...board.children].forEach(item => {
        item.classList.remove("correct", "incorrect");
    });
}

function setKeyListenerActive(active = true) {
    if (active) {
        addEventListener("keypress", handleKeyPress);
    } else {
        removeEventListener("keypress", handleKeyPress);
    }
}

function startInputHandler() {
    setStratagemCode();
    setKeyListenerActive();
}

function setStratagemCode() {
    const children = [...board.children];
    children.forEach(child=>board.removeChild(child));
    targetInput = getCurrentStratagemCode();
    for (const key of targetInput) {
        const boardItem = document.createElement("img");
        boardItem.src = Sprites.arrows[key];
        board.appendChild(boardItem);
    }
    wipeInput()
}