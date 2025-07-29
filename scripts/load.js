const running = true;


async function startGonzoGemHero() {
    while (running) {
        await startStratagemHandler();
        await sleep(250);
        for (let i = 0; i < 4; i++) {
            screen.style.backgroundColor = i % 2 === 0 ? "white" : null;
            await sleep(250);
        }
    }
}

startGonzoGemHero()