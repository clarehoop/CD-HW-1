let currentLevel = null;

function switchLevel(level) {
  if (currentLevel) currentLevel.cleanup();
  currentLevel = level;
  currentLevel.init();
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") switchLevel(Level1);
  if (event.code === "Digit2") switchLevel(Level2);
  if (event.code === "Digit3") switchLevel(Level3);
});

switchLevel(Level1); // start on Level 1
