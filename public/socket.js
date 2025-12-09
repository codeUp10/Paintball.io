let CrazySDK = null;
let sdkEnabled = false;

// Försök initiera SDK (fungerar bara på CrazyGames)
if (window.CrazyGames && window.CrazyGames.SDK) {
  window.CrazyGames.SDK.init()
    .then((sdk) => {
      CrazySDK = window.CrazyGames.SDK;
      
      // Kolla om SDK faktiskt är enabled
      const environment = sdk.environment || 'disabled';
      
      if (environment === 'disabled') {
        console.log('⚠️ SDK initialized but DISABLED (normal på Railway)');
        sdkEnabled = false;
        CrazySDK = null; // Sätt till null så vi inte försöker använda den
      } else {
        console.log('✅ CrazyGames SDK initialized and ENABLED!', environment);
        sdkEnabled = true;
      }
    })
    .catch((error) => {
      console.log('SDK init failed (normal på Railway):', error);
      CrazySDK = null;
      sdkEnabled = false;
    });
} else {
  console.log('SDK not available (normal på Railway)');
}

const BACKEND_URL = "https://paintballio-production.up.railway.app/";
const socket = io(BACKEND_URL); // Anslut direkt till din Railway-server

let nickname = null;
// Set gameWrapper i mitten
const gameWrapper = document.getElementById('gameWrapper')
const centerPosX = (-3006 + innerWidth) / 2 + 'px'
const centerPosY = (-3006 + innerHeight) / 2 + 'px'
gameWrapper.style.top = centerPosY
gameWrapper.style.left = centerPosX

let ammoLeft = 20;
let inControlPanel = false;
let showAAd = false;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

document.getElementById("playButton").addEventListener("click", () => {
  nickname = document.getElementById("nicknameInput").value.trim();
  if (!nickname) return;
  ammoLeft = 20
  document.getElementById("titleScreen").style.display = "none";
  document.getElementById('map').style.display = 'flex';
  document.getElementById('reload-bar').style.display = 'flex';
  document.getElementById('reload-bar-metre').style.display = 'flex';
  document.getElementById('building-material').style.display = 'flex';
  document.getElementById('leaderBoard').style.display = 'grid'
  gameWrapper.style.top = '0px'
  gameWrapper.style.left = '0px'
  gameWrapper.style.transformOrigin = '0 0';

  if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'block';
    document.getElementById('building-material').innerHTML = '<span id="building-material-left"></span>/3';
  }
  
  // Skicka nickname till servern
  socket.emit("setNickname", nickname);
  
  // Starta timer för nästa ad (alltid 1 minut efter spawn)
  setTimeout(() => {
    showAAd = true;
  }, 1 * 60 * 1000);  // 1 minut

  // Berätta för CrazyGames att gameplay startar
  if (CrazySDK && sdkEnabled) {
    CrazySDK.game.gameplayStart();
  }
});

const backdropElm = document.getElementById('backdrop')
const controlsImg = document.getElementById('controlsImg')
document.getElementById("controlsButton").addEventListener("click", () => {
  controlsImg.style.width = innerWidth * 0.55 + 'px'
  controlsImg.style.height = parseFloat(controlsImg.style.width) * 0.5 + 'px'
  controlsImg.style.display = 'flex'
  backdropElm.style.display = 'flex'

  setTimeout(() => {
    inControlPanel = true;
  }, 100);
});

if (isMobile) {
  // Joystick för rörelse
  const joystickZone = document.getElementById('joystick-zone');
  const joystickStick = document.getElementById('joystick-stick');
  
  let joystickTouchId = null; // Spara vilken touch som styr joysticken
  let joystickStartX = 0;
  let joystickStartY = 0;
  let rotationTouchId = null; // Spara vilken touch som styr rotation
  
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (joystickTouchId === null) {
      // Ta första touchen i joystick-zonen
      const touch = e.changedTouches[0];
      joystickTouchId = touch.identifier;
      const rect = joystickZone.getBoundingClientRect();
      joystickStartX = rect.left + rect.width / 2;
      joystickStartY = rect.top + rect.height / 2;
    }
  });
  
  document.addEventListener('touchmove', (e) => {
    // Hitta joystick touch och rotation touch separat
    let joystickTouch = null;
    let rotationTouch = null;
    
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      
      if (touch.identifier === joystickTouchId) {
        joystickTouch = touch;
      } else if (thisPlayer && touch.identifier === rotationTouchId) {
        // Använd endast den sparade rotation touch
        rotationTouch = touch;
      } else if (thisPlayer && rotationTouchId === null) {
        // Om ingen rotation touch är satt, använd första touchen utanför knappar
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        // Kolla om touchen är på knappar eller joystick
        const buttonZone = { x: window.innerWidth - 200, y: 0, width: 200, height: window.innerHeight };
        const joystickRect = joystickZone.getBoundingClientRect();
        
        if (touchX > buttonZone.x) {
          continue; // Skippa denna touch (den är på knappar)
        }
        
        if (touchX >= joystickRect.left && touchX <= joystickRect.right &&
            touchY >= joystickRect.top && touchY <= joystickRect.bottom) {
          continue; // Skippa denna touch (den är på joystick)
        }
        
        rotationTouch = touch;
        rotationTouchId = touch.identifier; // Spara denna touch för rotation
      }
    }
    
    // Hantera joystick
    if (joystickTouch) {
      const dx = joystickTouch.clientX - joystickStartX;
      const dy = joystickTouch.clientY - joystickStartY;
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 45;
      
      let finalX = dx;
      let finalY = dy;
      
      if (distance > maxDistance) {
        finalX = (dx / distance) * maxDistance;
        finalY = (dy / distance) * maxDistance;
      }
      
      joystickStick.style.transform = `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px))`;
      
      const normalizedX = finalX / maxDistance;
      const normalizedY = finalY / maxDistance;
      
      keypressed.w = normalizedY < -0.3;
      keypressed.s = normalizedY > 0.3;
      keypressed.a = normalizedX < -0.3;
      keypressed.d = normalizedX > 0.3;
      
      updateVelocity();
    }
    
    // Hantera rotation (separat från joystick)
    if (rotationTouch && thisPlayer) {
      mouseX = rotationTouch.clientX;
      mouseY = rotationTouch.clientY;
      
      // Zoom level (samma som i animate)
      const zoomLevel = isMobile ? 0.6 : 1.0;
      
      const playerCenterX = window.innerWidth / 2;
      const playerCenterY = window.innerHeight / 2;

      const dx = (mouseX - playerCenterX) / zoomLevel;
      const dy = (mouseY - playerCenterY) / zoomLevel;

      const angleRad = Math.atan2(dy, dx);
      angleDeg = angleRad * (180 / Math.PI);

      if (players[thisPlayer]) {
        players[thisPlayer].targetGunRotation = angleDeg;
      }
      
      emitIfAlive('playerRotated', { id: socket.id, angleDeg });
    }
  });
  
  joystickZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    
    // Kolla om joystick-touchen släpptes
    let joystickReleased = true;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === joystickTouchId) {
        joystickReleased = false;
        break;
      }
    }
    
    if (joystickReleased) {
      joystickTouchId = null;
      joystickStick.style.transform = 'translate(-50%, -50%)';
      
      keypressed.w = false;
      keypressed.s = false;
      keypressed.a = false;
      keypressed.d = false;
      updateVelocity();
    }
  });
  
  // Lyssna på touchend globalt för att rensa rotation touch
  document.addEventListener('touchend', (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === rotationTouchId) {
        rotationTouchId = null;
        break;
      }
    }
  });
  
  // Shoot button
  const shootButton = document.getElementById('shoot-button');
  shootButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    shootingEvent(e);
  });
  
  // Build button
  const buildButton = document.getElementById('build-button');
  buildButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    emitIfAlive('playerBuilding', thisPlayer);
  });
  
  // Reload button
  const reloadButton = document.getElementById('reload-button');
  reloadButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (ammoLeft === 0 && oneTime) {
      reloadLoadingText.style.display = 'flex';
      oneTime = false;
      setTimeout(() => {
        emitIfAlive('playerReloaded', thisPlayer);
        oneTime = true;
      }, 2000);
    }
  });
}

const players = {}; 
let projectiles = [];
const clientWalls = {};

document.addEventListener('wheel', function(e) {
  if (e.ctrlKey) {
      e.preventDefault();
  }
}, { passive: false });

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=')) {
      e.preventDefault();
  }
});

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '?' || e.key === '_' || e.key === '=')) {
      e.preventDefault();
  }
});

socket.on('kicked-afk', (message) => {
  alert(message);
  
  // Rensa spelaren visuellt
  const div = players[thisPlayer];
  const bar = document.getElementById(thisPlayer + 'HP');
  const nameElem = document.getElementById(thisPlayer + 'Nametag');

  if (div) div.remove();
  if (bar) bar.remove();
  if (nameElem) nameElem.remove();

  delete players[thisPlayer];
  thisPlayer = null;
  
  showTitleScreen()
  
  //Reconnect socket
  socket.disconnect();
  setTimeout(() => {
    socket.connect();
  }, 500);
});

socket.on('server-full', (message) => {
  alert(message);
  
  // Säkerställ att title screen visas
  const title = document.getElementById("titleScreen");
  if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'none';
  }
  if (title) {
    title.style.display = "flex";

    document.getElementById('map').style.display = 'none';
    document.getElementById('reload-bar').style.display = 'none';
    document.getElementById('reload-bar-metre').style.display = 'none';
    document.getElementById('leaderBoard').style.display = 'none';
    document.getElementById('building-material').style.display = 'none';
  }
  //Reconnect socket
  socket.disconnect();
  setTimeout(() => {
    socket.connect();
  }, 500);
});

let playerColor
function createPlayerDiv(id, x, y, color, nickname) {
  let border = `solid 3px hsl(${color}, 80%, 40%)`
  let arrowImg = './img/arrow_drop_down_40dp_000000_FILL0_wght400_GRAD0_opsz40.png'
  playerColor = color

  const playerContainer = document.createElement('div')
  playerContainer.id = id;
  playerContainer.style.width = '46px';
  playerContainer.style.height = '46px';
  playerContainer.style.position = 'absolute';
  playerContainer.style.left = x + 'px'
  playerContainer.style.top = y + 'px';
  playerContainer.style.zIndex = 2
  players[id] = playerContainer
  players[id].color = color

  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.width = '40px';
  div.style.height = '40px';
  div.style.backgroundColor = `hsl(${color}, 80%, 50%)`;
  div.style.left = '0px';
  div.style.top = '0px';
  div.style.borderRadius = '50%';
  div.style.border = border;
  playerContainer.appendChild(div);

  const arrow = document.createElement('img');
  arrow.style.position = 'absolute';
  arrow.style.left = '7px';
  arrow.style.top = '3px';
  arrow.style.width = '40px'
  arrow.style.height = '40px'
  arrow.style.transform = 'rotate(270deg)'
  arrow.src = arrowImg
  arrow.style.opacity = '0.2'

  playerContainer.appendChild(arrow);

  const gun = document.createElement('div')
  gun.id = id + 'GUN'
  gun.style.position = 'absolute'
  gun.style.width = '50px';
  gun.style.height = '15px';
  gun.style.backgroundColor = '#242424';
  gun.style.left = '-2px';
  gun.style.top = '39px';
  gun.style.borderRadius = '5px'
  gun.style.transformOrigin = "20px 7.5px";

  playerContainer.appendChild(gun);
  playerContainer.gun = gun;

  const marker = document.createElement('div')
  marker.style.id = id + 'Marker'
  marker.style.position = 'absolute'
  marker.style.width = '4px'
  marker.style.height = '7px'
  marker.style.backgroundColor = `hsl(${color}, 80%, 40%)`;
  marker.style.right = '3px'
  marker.style.top = '4px'

  gun.appendChild(marker);

  const healthBar = document.createElement('div')
  healthBar.id = id + 'HP'
  healthBar.style.position = 'absolute'
  healthBar.style.width = '60px'
  healthBar.style.height = '5px'
  healthBar.style.backgroundColor = '#24242466'
  healthBar.style.borderRadius = '3px'
  healthBar.style.zIndex = 2

  const healthProcentile = document.createElement('div')
  healthProcentile.id = id + 'HPProcentile'
  healthProcentile.style.position = 'absolute'
  healthProcentile.style.width = '60px'
  healthProcentile.style.height = '5px'
  healthProcentile.style.backgroundColor = '#00e554b6'
  healthProcentile.style.borderRadius = '3px'
  healthProcentile.style.zIndex = 2

  healthBar.appendChild(healthProcentile)
  healthBar.healthProcentile = healthProcentile

  gameWrapper.appendChild(healthBar);

  const nametag = document.createElement('p')
  nametag.id = id + 'Nametag'
  nametag.style.position = 'absolute' 
  nametag.style.color = `hsla(${color}, 80%, 40%, 0.9)`
  nametag.innerHTML = nickname
  nametag.style.textAlign = 'center'
  nametag.style.width = 100 + 'px'
  nametag.style.height = 20 + 'px'
  nametag.style.fontFamily = 'Trebuchet MS, sans-serif'
  nametag.style.fontSize = 13 + 'px'
  nametag.style.fontWeight = '900'
  nametag.style.textShadow = '2px 0 #ffffff70, -2px 0 #ffffff70, 0 2px #ffffff70, 0 -2px #ffffff70, 1px 1px #ffffff70, -1px -1px #ffffff70, 1px -1px #ffffff70, -1px 1px #ffffff70'
  nametag.style.zIndex = 2

  gameWrapper.appendChild(nametag)
  if (thisPlayer === id) {
    document.getElementById('building-material').style.color = `hsla(${color}, 80%, 35%, 0.7)`
    document.getElementById('reload-bar-metre').style.backgroundColor = `hsla(${color}, 80%, 50%, 0.8)`
    document.getElementById('reload-text').style.color = `hsla(${color}, 80%, 50%, 0.8)`
    document.getElementById('reloadLoadingText').style.color = `hsla(${color}, 80%, 35%, 1)`
  }

  playerContainer.style.transformOrigin = '50% 50%';
  gameWrapper.appendChild(playerContainer);
}

let thisPlayer

function emitIfAlive(event, data) {
  if (!thisPlayer) return;
  socket.emit(event, data);
}

socket.on('this-player', (id) => {
  // Rensa gamla spelardata innan du sätter nya thisPlayer
  if (thisPlayer && players[thisPlayer]) {
    const div = players[thisPlayer];
    const bar = document.getElementById(thisPlayer + 'HP');
    const nameElem = document.getElementById(thisPlayer + 'Nametag');

    if (div) div.remove();
    if (bar) bar.remove();
    if (nameElem) nameElem.remove();

    delete players[thisPlayer];
  }

  thisPlayer = id;
});


//projectiles
function createProjectileDiv(x, y, from, id) {
  let pColor
  if (!players[from]) {pColor = 1} else {
    pColor = players[from].color
  } 

  const ball = document.createElement('div')
  ball.id = id + 'Projectile';
  ball.style.position = 'absolute'
  ball.style.left = x + 'px';
  ball.style.top = y + 'px';
  ball.style.width = '13px';
  ball.style.height = '13px';
  ball.style.borderRadius = '50%';
  ball.style.backgroundColor = `hsl(${pColor}, 100%, 40%)`;
  ball.style.border = `solid 2px hsl(${pColor}, 100%, 20%)`;

  gameWrapper.appendChild(ball);
}

function createWallDiv(wall) {
  const wallDiv = document.createElement("div");
  wallDiv.id = wall.id;
  wallDiv.style.position = "absolute";
  wallDiv.style.width = wall.width + "px";
  wallDiv.style.height = wall.height + "px";
  wallDiv.style.left = wall.pos.x + "px";
  wallDiv.style.top = wall.pos.y + "px";
  wallDiv.style.backgroundColor = "#444"; 
  wallDiv.style.border = "2px solid #222";
  wallDiv.style.transform = `rotate(${wall.rotation}deg)`;
  wallDiv.style.transformOrigin = "center";

  gameWrapper.appendChild(wallDiv);
  clientWalls[wall.id] = wallDiv;
}

socket.on('current-players', (allPlayers) => {
    for (const id in allPlayers) {  
      const p = allPlayers[id];
      if (players[id]) {
      players[id].remove();
      delete players[id];
    }
    document.getElementById(id + 'HP')?.remove();
    document.getElementById(id + 'Nametag')?.remove();
    createPlayerDiv(id, p.x, p.y, p.color, p.nickname);
  }
});

// När en ny spelare kommer in
socket.on('new-player', (player) => { 
  if (players[player.id]) {
    players[player.id].remove();
    delete players[player.id];
  }

  document.getElementById(player.id + 'HP')?.remove();
  document.getElementById(player.id + 'Nametag')?.remove();

  createPlayerDiv(player.id, player.x, player.y, player.color, player.nickname);
});


function showTitleScreen() {
  const title = document.getElementById("titleScreen");
  title.style.display = "flex";
  title.style.opacity = 1;
  if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'none';
  }

  document.getElementById('map').style.display = 'none';
  document.getElementById('reload-bar').style.display = 'none';
  document.getElementById('reload-bar-metre').style.display = 'none';
  document.getElementById('leaderBoard').style.display = 'none';
  document.getElementById('building-material').style.display = 'none';
}

let velocity = { x: 0, y: 0};
let keypressed = { w: false, a: false, s: false, d: false };
let speed = 8;
let outOfBoundSide = { w: false, a: false, s: false, d: false }

function updateVelocity() {
  let x = 0;
  let y = 0;

  if (keypressed.w) y -= 1;
  if (keypressed.s) y += 1;
  if (keypressed.a) x -= 1;
  if (keypressed.d) x += 1;

  //Flyttar sig diagonalt
  if (x !== 0 && y !== 0) {
    x = x * speed / Math.sqrt(2);
    y = y * speed / Math.sqrt(2);
  } else {
    x = x * speed;
    y = y * speed;
  }

  const newVelocity = { x, y };
  if (newVelocity.x !== velocity.x || newVelocity.y !== velocity.y) {
    velocity = newVelocity;
    emitIfAlive('playerMoved', { id: socket.id, velocity });
  }

}

addEventListener('keydown', (e) => {
  let keyPressedLowerCase = e.key.toLowerCase()
  if (keyPressedLowerCase in keypressed) {
    if (
      keyPressedLowerCase !== outOfBoundSide.w &&
      keyPressedLowerCase !== outOfBoundSide.a &&
      keyPressedLowerCase !== outOfBoundSide.s &&
      keyPressedLowerCase !== outOfBoundSide.d
    ) {
      keypressed[keyPressedLowerCase] = true;
      updateVelocity();
    }
  }
});

addEventListener('keyup', (e) => {
  let keyPressedLowerCase = e.key.toLowerCase()
  if (keyPressedLowerCase in keypressed) {
    keypressed[keyPressedLowerCase] = false;
    updateVelocity();
  }
});


let serverPlayerList
let cords
const leaderBoardList = [];

socket.on('players', (ioPlayers) => {
  Object.values(ioPlayers).forEach(player => {
    if (!players[player.id]) return; 
    // --- Target Pos and Rotation
    players[player.id].targetPosition = { x: player.x, y: player.y };
    players[player.id].targetRotation = player.rotate
    // --- OUT OF BOUNDS
    const px = players[player.id].targetPosition.x;
    const py = players[player.id].targetPosition.y;
    const pWidth = parseInt(players[player.id].style.width);
    const pHeight = parseInt(players[player.id].style.height);

    const minBound = 3;
    const maxBound = 3003;

    if (px < minBound) {
      players[player.id].targetPosition.x = minBound;
      cords = { x: minBound, y: player.y, id: player.id, side: 'left' };
      emitIfAlive('outOfBounds', cords);
    }

    if (px + pWidth > maxBound) {
      players[player.id].targetPosition.x = maxBound - pWidth;
      cords = { x: maxBound - pWidth, y: player.y, id: player.id, side: 'right' };
      emitIfAlive('outOfBounds', cords);
    }

    if (py < minBound) {
      players[player.id].targetPosition.y = minBound;
      cords = { x: player.x, y: minBound, id: player.id, side: 'up' };
      emitIfAlive('outOfBounds', cords);
    }

    if (py + pHeight > maxBound) {
      players[player.id].targetPosition.y = maxBound - pHeight;
      cords = { x: player.x, y: maxBound - pHeight, id: player.id, side: 'down' };
      emitIfAlive('outOfBounds', cords);
    }

    if (px <= minBound) {
      outOfBoundSide.a = 'a';
    } else {
      outOfBoundSide.a = false;  
    }
    if (py <= minBound) {
      outOfBoundSide.w = 'w';
    } else {
      outOfBoundSide.w = false;  
    }
    if (px + pWidth >= maxBound) {
      outOfBoundSide.d = 'd';      
    } else {
      outOfBoundSide.d = false;  
    }
    if (py + pHeight >= maxBound) {
      outOfBoundSide.s = 's';
    } else {
      outOfBoundSide.s = false;  
    }
    
    //Uppdatera Health
    players[player.id].health = player.health
  });

  // LeaderBoard
  leaderBoardList.length = 0;

  Object.values(ioPlayers).forEach(player => {
    leaderBoardList.push({
      nickname: player.nickname,
      kills: player.kills ?? 0,
      color: player.color,
      id: player.id
    });
  });
  leaderBoardList.sort((a, b) => b.kills - a.kills);

  // Updatera buildmaterial left elm
  Object.values(ioPlayers).forEach(player => {
    if (player.id === thisPlayer) {
      const buildingMaterialLeftElm = document.getElementById('building-material-left')
      buildingMaterialLeftElm.innerHTML = player.buildingMaterial;
    }
  });

  //Uppdatera Spelare Online
  document.getElementById('playersOnline').innerHTML = Object.keys(ioPlayers).length

})

let mouseX = 0;
let mouseY = 0;

let angleDeg

document.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  const playerCenterX = window.innerWidth / 2;
  const playerCenterY = window.innerHeight / 2;

  const dx = mouseX - playerCenterX;
  const dy = mouseY - playerCenterY;

  const angleRad = Math.atan2(dy, dx);
  angleDeg = angleRad * (180 / Math.PI);

  if (players[thisPlayer]) {
    players[thisPlayer].targetGunRotation = angleDeg;
  }
  
  emitIfAlive('playerRotated', { id: socket.id, angleDeg })
});

function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

function shortestAngleDist(a, b) {
  a = normalizeAngle(a);
  b = normalizeAngle(b);

  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

socket.on('projectiles-positions', (allProjectiles) => {
  allProjectiles.forEach(newProjectile => {
    // Försök hitta befintlig projektil
    const existing = projectiles.find(p => p.projectileId === newProjectile.projectileId);

    if (existing) {
      existing.targetPosition = { x: newProjectile.pos.x, y: newProjectile.pos.y };
    } else {
      projectiles.push({
        ...newProjectile,
        targetPosition: { x: newProjectile.pos.x, y: newProjectile.pos.y }
      });
      createProjectileDiv(newProjectile.pos.x, newProjectile.pos.y, newProjectile.from, newProjectile.projectileId);
    }
  });
});

socket.on('neutralizeVelocity', (side) => {
  if (side === 'left' || side === 'right') {
    keypressed.a = false;
    keypressed.d = false;
  }
  if (side === 'up' || side === 'down') {
    keypressed.w = false;
    keypressed.s = false;
  }
  updateVelocity()
})

let i = 0;
function shootingEvent(e) {
  const playerElem = players[thisPlayer];
  if (!playerElem) return;

  // --- Viktigt: använd predicted position från DOM ---
  const playerX = parseFloat(playerElem.style.left) + playerElem.offsetWidth / 2;
  const playerY = parseFloat(playerElem.style.top) + playerElem.offsetHeight / 2;

  // Zoom level (samma som i animate)
  const zoomLevel = isMobile ? 0.6 : 1.0;

  // Skärmens centrum
  const screenCenterX = window.innerWidth / 2;
  const screenCenterY = window.innerHeight / 2;

  // Musens offset från skärmens centrum (justerat för zoom)
  const mouseOffsetX = (mouseX - screenCenterX) / zoomLevel;
  const mouseOffsetY = (mouseY - screenCenterY) / zoomLevel;

  // Musens världskoordinater
  const mouseWorldX = cameraPosition.x + mouseOffsetX;
  const mouseWorldY = cameraPosition.y + mouseOffsetY;

  // *Checkar så att musen inte är i spelarens radius
  const extraValue = 25
  if (
      parseFloat(playerElem.style.left) - extraValue < mouseWorldX &&
      parseFloat(playerElem.style.left) + extraValue + parseFloat(playerElem.style.width) > mouseWorldX &&
      parseFloat(playerElem.style.top) - extraValue < mouseWorldY &&
      parseFloat(playerElem.style.top) + extraValue + parseFloat(playerElem.style.height) > mouseWorldY
    ) return

  // Offset från mitten till pipans spets när rotation = 0
  const gunOffsetX = 33;
  const gunOffsetY = 24;

  // Rotation i radianer (predicted värde från animate)
  const a = (playerElem.currentRotation || 0) * Math.PI / 180;

  // Räkna fram pipans spets i världskoordinater
  const muzzleX = playerX + Math.cos(a) * gunOffsetX - Math.sin(a) * gunOffsetY;
  const muzzleY = playerY + Math.sin(a) * gunOffsetX + Math.cos(a) * gunOffsetY;

  // Riktning mot musen
  const angleToMouse = Math.atan2(mouseWorldY - muzzleY, mouseWorldX - muzzleX);
  const pSpeed = 20;
  const projectileSize = 17;
    
  emitIfAlive('playerClicked', {
    id: thisPlayer,
    x: muzzleX - projectileSize / 2 + velocity.x,
    y: muzzleY - projectileSize / 2 + velocity.y,
    velocity: {
      x: Math.cos(angleToMouse) * pSpeed,
      y: Math.sin(angleToMouse) * pSpeed
    },
    projectileId: `${thisPlayer}${i}`
  });
  
  i++;
}

document.addEventListener('click', (e) => {
  if (inControlPanel) {
    inControlPanel = false
    controlsImg.style.display = 'none'
    backdropElm.style.display = 'none'
  }
  shootingEvent(e);
});

socket.on('projectileDeleted', (projectileId) => {
  // Hitta och ta bort från arrayen
  const index = projectiles.findIndex(p => p.projectileId === projectileId);
  if (index !== -1) {
    projectiles.splice(index, 1);
  }

  // Hitta och ta bort från DOM
  const elem = document.getElementById(projectileId + 'Projectile');
  if (elem) {
    elem.remove();
  }
});

socket.on('fadeProjectile', (projectile) => {
  const elem = document.getElementById(projectile.id + 'Projectile');
  let fadeDuration = projectile.duration === 100 ? 0.1 : 0.5;

  if (elem) {
    elem.style.transition = `opacity ${fadeDuration}s linear`;
    elem.style.opacity = "0";
  }
});

// Walls events
socket.on("wall-damaged", data => {
  const div = clientWalls[data.id];
  if (!div) return;

  let procentileMaxWallHealth = data.health / 150

  div.style.opacity = Math.max(0.3, (0.7 * procentileMaxWallHealth) + 0.3);
});

socket.on("wall-destroyed", (id) => {
  const div = clientWalls[id];
  if (!div) return;

  div.remove();
  delete clientWalls[id];
});


socket.on('projectile-correct', (data) => {
  const projectile = projectiles.find(p => p.projectileId === data.id);
  const elem = document.getElementById(data.id + 'Projectile');
  if (!projectile || !elem) return;

  projectile.pos = data.pos;
  projectile.velocity = data.velocity;
  projectile.targetPosition = data.pos;

  elem.style.left = data.pos.x + "px";
  elem.style.top = data.pos.y + "px";
});


socket.on('reload-bar', (ammoLeftServer) => {
  ammoLeft = ammoLeftServer;
});

let oneTime = true
addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && ammoLeft === 0 && oneTime) {
    reloadLoadingText.style.display = 'flex'
    oneTime = false
    setTimeout(() => {
      emitIfAlive('playerReloaded', thisPlayer)
      oneTime = true
    }, 2000);
  }

  if (e.code === 'KeyF') {
    emitIfAlive('playerBuilding', thisPlayer)
  }
  
  if (e.code === 'Space') {
    shootingEvent(e);
  }
  
});

// Walls
socket.on("current-walls", (allWalls) => {
  for (const id in allWalls) {
    if (!clientWalls[id]) {
      createWallDiv(allWalls[id]);
    }
  }
});

socket.on("wall-created", (wall) => {
    createWallDiv(wall);
});

let imagePopUpOnce = false;
let rotation = 0
let cameraPosition = { x: 0, y: 0 };
function animate() { 
  // --- Leader Board ---
  for (let i = 1; i <= 5; i++) {
      const elemName = document.getElementById(`playerNr${i}`);
      const elemKills = document.getElementById(`playerKillsNr${i}`);
      const entry = leaderBoardList[i - 1];

      if (entry) {
        let alpha = 0.6
        if (thisPlayer === entry.id) {
          alpha = 1
          elemName.style.fontWeight = '800'
          elemKills.style.fontWeight = '800'
        }
        elemName.innerHTML = `#${i} ${entry.nickname}`;
        elemName.style.color = `hsla(${entry.color}, 80%, 35%, ${alpha})`
        elemKills.innerHTML = ` ${entry.kills}`
        elemKills.style.color = `hsla(${entry.color}, 80%, 35%, ${alpha})`
      } else {
          elemName.innerHTML = ""; // Tomma rader om färre än 5 spelare
          elemKills.innerHTML = "";
      }
  }

  // --- MAP ---
  const mapElm = document.getElementById('map')
  let sideLength = innerWidth * 0.15
  mapElm.style.width = sideLength + 'px'
  mapElm.style.height = sideLength + 'px'

  // --- Reload Bar ---
  const reloadBar = document.getElementById('reload-bar')
  const reloadBarMetre = document.getElementById('reload-bar-metre')
  const ammoAmountElm = document.getElementById('ammoAmount')
  const reloadImg = document.getElementById('reloadImg')
  const reloadLoadingText = document.getElementById('reloadLoadingText')
  const widthOfReloadsElm = innerWidth * 0.17
  const procentileOfFullReload = ammoLeft / 20
  reloadBar.style.width = widthOfReloadsElm + 'px'
  reloadBarMetre.style.width = widthOfReloadsElm * procentileOfFullReload + 'px'
  ammoAmountElm.innerHTML = ammoLeft

  if (ammoLeft === 0 && !imagePopUpOnce) {
    reloadImg.src = './img/red_icon.png'
    reloadImg.style.opacity = 0.85;
    imagePopUpOnce = true
  } else if (ammoLeft > 0) {
    reloadImg.src = './img/black_icon.png'
    reloadImg.style.opacity = 0.5;
    reloadLoadingText.style.display = 'none'
    imagePopUpOnce = false
  }

  // --- Projektiler ---
  projectiles.forEach((projectile) => {
    const projectileDiv = document.getElementById(projectile.projectileId + 'Projectile');
    if (!projectileDiv) return;

    // Om vi inte fått någon serverposition ännu -> hoppa över
    if (!projectile.targetPosition) return;

    // Hämta nuvarande renderad position
    let currentX = parseFloat(projectileDiv.style.left) || projectile.targetPosition.x;
    let currentY = parseFloat(projectileDiv.style.top) || projectile.targetPosition.y;

    // Skillnaden mellan där vi är och dit servern säger att vi ska vara
    const dx = projectile.targetPosition.x - currentX;
    const dy = projectile.targetPosition.y - currentY;

    // Interpolera mjukt mot serverns position
    const smoothing = 0.2;
    currentX += dx * smoothing;
    currentY += dy * smoothing;

    projectileDiv.style.left = currentX + "px";
    projectileDiv.style.top = currentY + "px";
  });


  // --- Spelare ---
  for (const id in players) {
    const playerDiv = players[id];

    if (!playerDiv) continue;
    let target = playerDiv.targetPosition;
    if (!target) continue;

    let currentX = parseFloat(playerDiv.style.left);
    let currentY = parseFloat(playerDiv.style.top);

    // Om vi vet spelarens velocity -> prediktera
    if (playerDiv.velocity) {
      currentX += playerDiv.velocity.x;
      currentY += playerDiv.velocity.y;
    }

    // Gör en mjuk korrektion mot serverns target
    currentX += (target.x - currentX) * 0.2;
    currentY += (target.y - currentY) * 0.2;

    playerDiv.style.left = currentX + "px";
    playerDiv.style.top = currentY + "px";

    //healthbar följer spelaren
    let healthbarId = playerDiv.id + 'HP'
    let healthBarElement = document.getElementById(healthbarId)
    if (healthBarElement) {
      const barX = currentX + parseInt(playerDiv.style.width) / 2 - parseInt(healthBarElement.style.width) / 2;
      const barY = currentY - 10; // lite ovanför huvudet
      healthBarElement.style.left = barX + "px";
      healthBarElement.style.top = barY + "px";
    }
    if (healthBarElement && healthBarElement.healthProcentile) {
      healthBarElement.healthProcentile.style.width = playerDiv.health + 'px';
    }

    //nametag följer spelaren
    let nametagId = playerDiv.id + 'Nametag'
    let nametagElement = document.getElementById(nametagId)
    if (nametagElement) {
      let nameX = currentX + parseInt(playerDiv.style.width) / 2 - parseInt(nametagElement.scrollWidth) / 2;
      let nameY = currentY - 41
      if (playerDiv.id === thisPlayer) {
        document.body.appendChild(nametagElement);
        let width = 500

        nametagElement.style.position = 'fixed'
        nametagElement.style.bottom = 5 + 'px'
        nametagElement.style.left = innerWidth / 2 - width / 2 + 'px'
        nametagElement.style.fontSize = '30px'
        nametagElement.style.width = width + 'px'
        if (isMobile) {
          nametagElement.style.bottom = 15 + 'px'
        }
      } else {
        nametagElement.style.left = nameX + "px";
        nametagElement.style.top = nameY + "px";
      }
    }

    // Rotation prediction
    let rotateTarget = playerDiv.targetRotation;
    if (rotateTarget !== undefined) {
      if (playerDiv.currentRotation === undefined) {
        playerDiv.currentRotation = normalizeAngle(rotateTarget);
      } else {
        const diff = shortestAngleDist(playerDiv.currentRotation, rotateTarget);
        playerDiv.currentRotation = normalizeAngle(playerDiv.currentRotation + diff * 0.2);
      }
      playerDiv.style.transform = `rotate(${playerDiv.currentRotation}deg)`;
    }

    // Kamera följer spelaren
    if (playerDiv.id === thisPlayer) {
      const playerCenterX = currentX + playerDiv.offsetWidth / 2;
      const playerCenterY = currentY + playerDiv.offsetHeight / 2;

      cameraPosition.x += (playerCenterX - cameraPosition.x) * 0.2;
      cameraPosition.y += (playerCenterY - cameraPosition.y) * 0.2;

      // Zoom: mobil zoomar ut för att se mer
      const zoomLevel = isMobile ? 0.6 : 1.0;

      const screenCenterX = window.innerWidth / 2;
      const screenCenterY = window.innerHeight / 2;

      const tx = screenCenterX - (cameraPosition.x * zoomLevel);
      const ty = screenCenterY - (cameraPosition.y * zoomLevel);

      gameWrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${zoomLevel})`;
    }

    // Map Nodes
    const nodeExist = document.getElementById(playerDiv.id + 'Node') !== null;
    if (!nodeExist) {
      let newNode = document.createElement('div'); 
      newNode.id = playerDiv.id + 'Node';
      
      let radius = 7;
      newNode.style.backgroundColor = `hsl(${playerDiv.color}, 80%, 50%)`;
      newNode.style.width = radius + 'px';
      newNode.style.height = radius + 'px';
      newNode.style.position = 'absolute';
      newNode.style.zIndex = 1001;
      newNode.style.borderRadius = '50%';
      
      mapElm.appendChild(newNode);
    }

    const allNodes = mapElm.querySelectorAll("div[id$='Node']");
    allNodes.forEach(div => {
      const baseId = div.id.replace(/Node$/, ''); 
        if (!(baseId in players)) {
          div.remove();
          return;
        }
        const playerWithId = players[baseId]
        const scale = gameWrapper.offsetWidth / sideLength;
      
        div.style.left = (parseFloat(playerWithId.style.left) / scale) + 'px';
        div.style.top = (parseFloat(playerWithId.style.top) / scale) + 'px';
      });
  }

  const scale = 3006 / sideLength;
  Object.values(clientWalls).forEach(wallDiv => {
    const wallId = wallDiv.id;

    let wallNode = document.getElementById(wallId + 'WallNode');
    if (!wallNode) {
      wallNode = document.createElement('div');
      wallNode.id = wallId + 'WallNode';
      wallNode.style.position = 'absolute';
      wallNode.style.backgroundColor = '#666';
      wallNode.style.border = '1px solid #333';
      wallNode.style.opacity = '0.7';
      wallNode.style.zIndex = '1000';
      wallNode.style.pointerEvents = 'none';
      mapElm.appendChild(wallNode);
    }

    const worldX = parseFloat(wallDiv.style.left) + parseFloat(wallDiv.style.width) / 2;
    const worldY = parseFloat(wallDiv.style.top)  + parseFloat(wallDiv.style.height) / 2;

    const mapX = worldX / scale;
    const mapY = worldY / scale;

    const wallWidthMap  = parseFloat(wallDiv.style.width)  / scale;
    const wallHeightMap = parseFloat(wallDiv.style.height) / scale;

    wallNode.style.left = (mapX - wallWidthMap  / 2) + 'px';
    wallNode.style.top = (mapY - wallHeightMap / 2) + 'px';
    wallNode.style.width = wallWidthMap + 'px';
    wallNode.style.height = wallHeightMap + 'px';

    const rotation = wallDiv.style.transform.match(/rotate\(([-0-9.]+)deg\)/);
    if (rotation) {
      wallNode.style.transform = `rotate(${rotation[1]}deg)`;
      wallNode.style.transformOrigin = 'center';
    }
  });

  // Ta bort noder för väggar som inte längre finns
  const allWallNodes = mapElm.querySelectorAll("div[id$='WallNode']");
  allWallNodes.forEach(node => {
    const baseId = node.id.replace('WallNode', '');
    if (!clientWalls[baseId]) {
      node.remove();
    }
  });

  requestAnimationFrame(animate);
}

animate();

socket.on("player-died", () => {
  // Ta bara bort din egen spelare
  const div = players[thisPlayer];
  const bar = document.getElementById(thisPlayer + 'HP');
  const nameElem = document.getElementById(thisPlayer + 'Nametag');

  if (div) div.remove();
  if (bar) bar.remove();
  if (nameElem) nameElem.remove();

  delete players[thisPlayer];
  thisPlayer = null;

  // VISA AD (om SDK är ENABLED på CrazyGames OCH minst 1 min spelat)
  if (CrazySDK && sdkEnabled && showAAd) {
    console.log('Visar ad (spelat över 1 minut)...');
    CrazySDK.ad.requestAd('midgame', {
      adFinished: () => {
        console.log('Ad klar!');
        showAAd = false;
        showTitleScreen();
      },
      adError: (error) => {
        console.log('Ad error:', error);
        showAAd = false;
        showTitleScreen();
      },  
      adStarted: () => {
        console.log('Ad startad');
      }
    });
  } else {
    // Ingen SDK, SDK disabled, eller < 1 minut spelat
    console.log('Ingen ad (SDK disabled eller < 1 min spelat)');
    showAAd = false;
    showTitleScreen();
  }

  i = 0;
});

// När någon lämnar
socket.on('player-left', (id) => {
  const div = players[id];
  const bar = document.getElementById(id + 'HP')
  const nameElem = document.getElementById(id + 'Nametag')
  
  if (div) {
    div.remove();
    delete players[id];
  }
  if (bar) {
    bar.remove()
  }
  if (nameElem) {
    nameElem.remove()
  }
});

socket.on("remove-player", (id) => {
  const div = players[id];
  const bar = document.getElementById(id + 'HP');
  const nameElem = document.getElementById(id + 'Nametag');

  if (div) div.remove();
  if (bar) bar.remove();
  if (nameElem) nameElem.remove();

  delete players[id];
});

window.addEventListener('beforeunload', () => {
  if (CrazySDK && sdkEnabled) {
    CrazySDK.game.gameplayStop();
  }
});