async function start() {
    // Hub text is fitted by measuring it, so the font has to be in first.
    await Promise.all([loadData(), document.fonts.load("12px HD")]);
    setStreak();
    await nextStratagem();
}

start();