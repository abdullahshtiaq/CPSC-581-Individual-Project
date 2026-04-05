const interactionSections = document.querySelectorAll(".interaction");
const fishtank = document.getElementById("fish-video");

fishtank.volume = 0.3;

// --- Data ---

const fishData = [
  {
    image: "guppy.jpeg",
    fact: "Guppies are known as million fish as they breed so prolifically!"
  },
  {
    image: "molly.jpeg",
    fact: "Mollies can adapt to many different water conditions, including freshwater and saltwater!"
  },
  {
    image: "platy.jpeg",
    fact: "Platys are natural pest controllers!"
  }
];

const tankData = {
  lastWaterChange: "2024-11-10",
  waterHealth: {
    ph: 7.5,
    alkalinity: "Moderate",
    hardness: "Soft"
  }
};

// --- Thresholds (calibrate after mounting camera) ---

const CLOSE_THRESHOLD = 120;   // face_width_px — person is within ~1–1.5m
const YAW_FACING = 30;         // degrees — person is facing the tank

// --- Clock ---

function updateTime() {
  const clock = document.getElementById("clock");
  if (clock) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    clock.textContent = `${h}:${m}:${s}`;
  }
}

setInterval(updateTime, 1000);
updateTime();

// --- Interaction display ---

function showInteraction(type) {
  interactionSections.forEach(section => {
    section.classList.toggle("active", section.classList.contains(type));
  });
}

// --- Light bar ---

function setLightBarColor(color) {
  const lightBar = document.querySelector(".light-bar");
  if (lightBar) lightBar.style.backgroundColor = color;
}

function resetLightBar() {
  setLightBarColor("white");
}

// --- Proxemic interactions ---

function showDistance(data) {
  if (data.face_width_px > CLOSE_THRESHOLD) {
    showInteraction("distance");
    displayAllFish();
    return true;
  }
  showInteraction("default");
  return false;
}

function showIdentity(data) {
  if (data.identity === "owner" && data.face_width_px > CLOSE_THRESHOLD) {
    showInteraction("identity");
    populateIdentityDetails();
    return true;
  }
  return false;
}

function showOrientation(data) {
  if (Math.abs(data.yaw) < YAW_FACING) {
    setLightBarColor("#006994"); // ocean blue — facing tank
  } else {
    setLightBarColor("white");  // away from tank
  }
}

function processPersonData(data) {
  if (!data.detected) {
    showInteraction("default");
    resetLightBar();
    return;
  }

  showOrientation(data);

  if (!showIdentity(data)) {
    showDistance(data);
  }
}

// --- Fish display ---

function displayAllFish() {
  const fishDisplay = document.getElementById("fish-display");
  if (!fishDisplay) return;

  fishDisplay.innerHTML = "";

  fishData.forEach(fish => {
    const container = document.createElement("div");
    container.className = "fish-container";

    const img = document.createElement("img");
    img.src = fish.image;
    img.alt = "Fish Image";
    container.appendChild(img);

    const fact = document.createElement("p");
    fact.textContent = fish.fact;
    container.appendChild(fact);

    fishDisplay.appendChild(container);
  });
}

// --- Identity details ---

function populateIdentityDetails() {
  const waterPhEl = document.getElementById("water-ph");
  const waterAlkalinityEl = document.getElementById("water-alkalinity");
  const waterHardnessEl = document.getElementById("water-hardness");

  if (waterPhEl) waterPhEl.textContent = tankData.waterHealth.ph;
  if (waterAlkalinityEl) waterAlkalinityEl.textContent = tankData.waterHealth.alkalinity;
  if (waterHardnessEl) waterHardnessEl.textContent = tankData.waterHealth.hardness;

  const performWaterChangeBtn = document.getElementById("water-change");
  const waterChangeStatusEl = document.getElementById("water-change-status");

  if (performWaterChangeBtn && waterChangeStatusEl) {
    performWaterChangeBtn.onclick = () => {
      waterChangeStatusEl.style.display = "block";
    };
  }
}

// --- WebSocket connection to Python CV backend ---

function connectWebSocket() {
  const ws = new WebSocket("ws://localhost:8765");

  ws.onmessage = event => {
    const data = JSON.parse(event.data);
    processPersonData(data);
  };

  ws.onerror = () => ws.close();

  ws.onclose = () => {
    // Retry connection every 2 seconds if backend isn't up yet
    setTimeout(connectWebSocket, 2000);
  };
}

window.onload = connectWebSocket;
