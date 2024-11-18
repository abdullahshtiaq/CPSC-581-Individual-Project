const distanceBtn = document.getElementById("distance-btn");
const orientationBtn = document.getElementById("orientation-btn");
const identityBtn = document.getElementById("identity-btn");
const interactionSections = document.querySelectorAll(".interaction");
const video = document.getElementById('video');
var canvas, context, imageData, detector, posit;
var markerSize = 150.0;
const fishtank = document.getElementById("fish-video");


fishtank.volume = 0.3;

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



function updateTime(){
  const clock = document.getElementById("clock");

  if (clock) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    clock.textContent = `${hours}:${minutes}:${seconds}`;
  }
}

setInterval(updateTime, 1000);

updateTime(); 

function showInteraction(type) {
    interactionSections.forEach((section) => {
        const isMatch = section.classList.contains(type);
        section.classList.toggle("active", isMatch); 
    });

    console.log("Active Sections:");
    interactionSections.forEach((section) => {
        if (section.classList.contains("active")) {
            console.log(section);
        }
    });
}


function onLoad(){
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
  
    canvas.width = parseInt(canvas.style.width);
    canvas.height = parseInt(canvas.style.height);    

    
    navigator.mediaDevices.getUserMedia({video: true})
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(console.error);

      detector = new AR.Detector();
      posit = new POS.Posit(markerSize, canvas.width);

      requestAnimationFrame(tick);
    }

    function processMarkers(markers) {
        if (markers.length > 0) {
            console.log("Markers Detected:", markers.map(marker => marker.id));
    
            showDistance(markers);
            showIdentity(markers);
            showOrientation(markers);
        } else {
            console.log("No markers detected.");
            showInteraction("default");
            resetLightBar();
        }
    }
  
    function tick() {
        requestAnimationFrame(tick);
    
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            snapshot();
    
            const markers = detector.detect(imageData);
            drawCorners(markers);
            drawId(markers);
            drawCornerPosition(markers);
    
            processMarkers(markers);
        }
    }

  function snapshot(){
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  }
  
  function calculateDistance(point1, point2) {
    const xDiff = point2[0] - point1[0];
    const yDiff = point2[1] - point1[1];
    const zDiff = point2[2] - point1[2];
    
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff + zDiff * zDiff);
}

function showDistance(markers) {
    const distanceThreshold = 1000; 

    for (let marker of markers) {
        const distance = calculateMarkerDistanceToCamera(marker);
        console.log(`Distance to Camera: ${distance}`);

        if (distance < distanceThreshold) {
            console.log("Showing Distance Interaction");
            showInteraction("distance");
            displayAllFish();
            return; 
        } else {
          showInteraction("default");
        }
    }

    console.log("Distance interaction not triggered.");
}


function showIdentity(markers) {
    const ownerId = 0; 
    const distanceThreshold = 1000;

    for (let marker of markers) {
        if (marker.id === ownerId) {
            const distance = calculateMarkerDistanceToCamera(marker);
            console.log(`Owner Marker Distance: ${distance}`);

            if (distance <= distanceThreshold) {
                console.log("Showing Identity Interaction");
                showInteraction("identity");
                populateIdentityDetails();
                return;
            }
        }
    }

    console.log("Identity interaction not triggered.");
}


function showOrientation(markers) {
    const frontFacingId = 1; 
    const awayFacingId = 2; 
    const distanceThreshold = 1000;

    let frontFacingDetected = false;
    let awayFacingDetected = false;

    markers.forEach(marker => {
        const distance = calculateMarkerDistanceToCamera(marker);
        if (marker.id === frontFacingId) {
          if (distance < distanceThreshold) {
            console.log("Front facing marker detected!");
            setLightBarColor("#006994"); 
            frontFacingDetected = true;
          }
        } else if (marker.id === awayFacingId) {
            console.log("Away facing marker detected!");
            setLightBarColor("white"); 
            awayFacingDetected = true;
        }
    });

    if (!frontFacingDetected && !awayFacingDetected) {
        console.log("No orientation markers detected, resetting light bar.");
        resetLightBar();
    }
}

function setLightBarColor(color) {
    const lightBar = document.querySelector(".light-bar");
    if (lightBar) {
        lightBar.style.backgroundColor = color;
    }
}

function resetLightBar() {
    const lightBar = document.querySelector(".light-bar");
    if (lightBar) {
        lightBar.style.backgroundColor = "white"; 
    }
}


function calculateMarkerDistance(marker1, marker2) {
    const corners1 = marker1.corners.map(corner => ({
        x: corner.x - canvas.width / 2,
        y: (canvas.height / 2) - corner.y,
    }));
    const corners2 = marker2.corners.map(corner => ({
        x: corner.x - canvas.width / 2,
        y: (canvas.height / 2) - corner.y,
    }));

    const pose1 = posit.pose(corners1);
    const pose2 = posit.pose(corners2);

    return calculateDistance(pose1.bestTranslation, pose2.bestTranslation);
}

function calculateMarkerDistanceToCenter(marker) {
    const corners = marker.corners.map(corner => ({
        x: corner.x - canvas.width / 2,
        y: (canvas.height / 2) - corner.y,
    }));

    const pose = posit.pose(corners);
    return calculateDistance(pose.bestTranslation, [0, 0, 0]);
}

function calculateMarkerDistanceToCamera(marker) {
    const corners = marker.corners.map(corner => ({
        x: corner.x - canvas.width / 2,
        y: (canvas.height / 2) - corner.y,
    }));

    const pose = posit.pose(corners); 

    return calculateDistance(pose.bestTranslation, [0, 0, 0]);
}
        
  function updateProxemicButton(howClose, near, medium, far) {
    const button = document.getElementById("proxemicButton");
    if (button != null) {
      if (howClose <= near) {
        button.textContent = "Too close!";
      } else if (howClose > near && howClose <= medium) {
        button.textContent = "Just right.";
      } else if (howClose > medium && howClose <= far) {
        button.textContent = "A little closer";
      } else {
        button.textContent = "I'm lonely";
      }
    }
  };

  function drawCorners(markers){
    var corners, corner, i, j;
  
    context.lineWidth = 3;

    for (i = 0; i !== markers.length; ++ i){
      corners = markers[i].corners;
      
      context.strokeStyle = "red";
      context.beginPath();
      
      for (j = 0; j !== corners.length; ++ j){
        corner = corners[j];
        context.moveTo(corner.x, corner.y);
        corner = corners[(j + 1) % corners.length];
        context.lineTo(corner.x, corner.y);
      }

      context.stroke();
      context.closePath();
      
      context.strokeStyle = "green";
      context.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
    }
  }

  function drawId(markers){
    var corners, corner, x, y, i, j;
    
    context.strokeStyle = "green";
    context.lineWidth = 1;
    
    for (i = 0; i !== markers.length; ++ i){
      corners = markers[i].corners;
      
      x = Infinity;
      y = Infinity;
      
      for (j = 0; j !== corners.length; ++ j){
        corner = corners[j];
        
        x = Math.min(x, corner.x);
        y = Math.min(y, corner.y);
      }

      context.strokeText(markers[i].id, x, y-10) 
    }
  }

  function drawCornerPosition(markers){
    var corners, corner, x, y, i, j, k, pose;
    
    context.strokeStyle = "blue";
    context.lineWidth = 1;
    
    for (i = 0; i !== markers.length; ++ i){
      corners = markers[i].corners;
      
      x = Infinity;
      y = Infinity;
      
      for (j = 0; j !== corners.length; ++ j){
        corner = corners[j];
        
        x = Math.min(x, corner.x);
        y = Math.min(y, corner.y);
      }

      for (k = 0; k < corners.length; ++ k){
        corner = corners[k];
        
        corner.x = corner.x - (canvas.width / 2);
        corner.y = (canvas.height / 2) - corner.y;
      }
      
      pose = posit.pose(corners);
      var positionInSpace = pose.bestTranslation;
      context.strokeText(Math.trunc(positionInSpace[0]) + "," + 
        Math.trunc(positionInSpace[1]) + "," + 
        Math.trunc(positionInSpace[2]), x, y)
    }
  }

  function displayAllFish() {
    const fishDisplay = document.getElementById("fish-display");

    if (!fishDisplay) {
      console.error("Fish display element not found");
      return;
    }

    fishDisplay.innerHTML= "";

    fishData.forEach( fish => {
      const fishContainer = document.createElement("div");
      fishContainer.className = "fish-container";

      const fishImage = document.createElement("img");

      fishImage.src = fish.image;
      fishImage.alt = "Fish Image";
      fishContainer.appendChild(fishImage);

      const fishFact = document.createElement("p");

      fishFact.textContent = fish.fact;
      fishContainer.appendChild(fishFact);

      fishDisplay.appendChild(fishContainer);
    });
  }


  window.onload = onLoad;

  function populateIdentityDetails() {
    const lastWaterChangeEl = document.getElementById("last-water-change");
    if (lastWaterChangeEl) {
        lastWaterChangeEl.textContent = tankData.lastWaterChange;
    }

    const waterPhEl = document.getElementById("water-ph");
    const waterAlkalinityEl = document.getElementById("water-alkalinity");
    const waterHardnessEl = document.getElementById("water-hardness");

    if (waterPhEl) waterPhEl.textContent = tankData.waterHealth.ph;
    if (waterAlkalinityEl) waterAlkalinityEl.textContent = tankData.waterHealth.alkalinity;
    if (waterHardnessEl) waterHardnessEl.textContent = tankData.waterHealth.hardness;

    const performWaterChangeBtn = document.getElementById("water-change");
    const waterChangeStatusE1 = document.getElementById("water-chnage-status");

    if (performWaterChangeBtn && waterChangeStatusE1) {
        performWaterChangeBtn.addEventListener("click", () => {
          waterChangeStatusEl.textContent = "Status: Water change performed successfully!";
          waterChangeStatusEl.style.display = "block";
        });
    }
}