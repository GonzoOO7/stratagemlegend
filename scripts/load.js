async function start() {
    await loadData();
    setStreak();
    await nextStratagem();
}

start();