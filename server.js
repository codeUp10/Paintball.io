const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const port = process.env.PORT || 3000;

app.use(express.static('public'));

const players = {};
const projectiles = [];
const walls = {};
const WORLD_SIZE = 3006;

io.on('connection', (socket) => {
  console.log('Ny användare ansluten:', socket.id);

  // När spelaren kopplas bort
  socket.on('disconnect', () => {
    console.log('Spelare lämnade:', socket.id);
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('player-left', socket.id);
    }
  });

  socket.emit('current-players', players);
  socket.emit('current-walls', walls)

  let nickname = "Unnamed";

  socket.on("setNickname", (nick) => {
    nickname = nick;

    let hue = Math.floor(Math.random() * 360);
    let color = hue;

    const player = {
      id: socket.id,
      nickname: nickname,
      x: Math.floor(Math.random() * WORLD_SIZE),
      y: Math.floor(Math.random() * WORLD_SIZE),
      velocity: { x: 0, y: 0 },
      color: color,
      rotate: 0,
      health: 60,
      width: 46,
      height: 46,
      reload: 20,
      kills: 0,
      buildingMaterial: 3,
      blockX: false,
      blockY: false
    };

    players[socket.id] = player;

    socket.emit('this-player', socket.id);
    socket.emit('current-players', players);
    socket.broadcast.emit('new-player', player);
    socket.emit('current-walls', walls)
  });

  socket.on('playerMoved', (player) => {
    if (!players[player.id]) return;
    players[player.id].velocity.x = player.velocity.x;
    players[player.id].velocity.y = player.velocity.y;
  });

  socket.on('playerRotated', (player) => {
    if (!players[player.id]) return;
    players[player.id].rotate = player.angleDeg;
  });

  socket.on('playerClicked', (projectile) => {
     if (!players[projectile.id]) return;
  
    let ammoLeft = players[projectile.id].reload;
    if (ammoLeft === 0) return;

    let radius = 13;
    let correctedX = parseFloat(projectile.x);
    let correctedY = parseFloat(projectile.y);
    
    if (projectile.x < 0) {
      correctedX = 0
    } 
    if (projectile.y < 0) {
      correctedY = 0 
    } 
    if (projectile.x + radius > WORLD_SIZE) {
      correctedX = WORLD_SIZE - radius
    } 
    if (projectile.y + radius > WORLD_SIZE) {
      correctedY = WORLD_SIZE - radius
    } 

    const newProjectile = {
      from: projectile.id,
      pos: { x: correctedX, y: correctedY },
      velocity: { x: projectile.velocity.x, y: projectile.velocity.y },
      projectileId: projectile.projectileId,
      fading: false,
      width: radius,
      height: radius,
      interpolationValueX: 17,
      interpolationValueY: 17,
      changedInterpolationValueX: false,
      changedInterpolationValueY: false,
      throughWall: false
    };

    projectiles.push(newProjectile);
    --players[projectile.id].reload;
    socket.emit('reload-bar', players[projectile.id].reload)

    io.emit('projectiles-positions', [newProjectile]);

    // Starta fade efter 2s
    setTimeout(() => {
      fadeProjectile(newProjectile, 500);
    }, 2000);
  });

  socket.on('playerReloaded', (playerId) => {
    players[playerId].reload = 20
    socket.emit('reload-bar', players[playerId].reload)
  });

  socket.on('outOfBounds', (cords) => {
    if (!players[cords.id]) return;
    players[cords.id].x = cords.x;
    players[cords.id].y = cords.y;
    if (cords.side === 'left' || cords.side === 'right') {
      players[cords.id].velocity.x = 0
      socket.emit('neutralizeVelocity', cords.side)
    }
    if (cords.side === 'up' || cords.side === 'down') {
      players[cords.id].velocity.y = 0
      socket.emit('neutralizeVelocity', cords.side)
    }
  });

  //player builds wall
  socket.on('playerBuilding', (id) => {
    const player = players[id];
    if (!player) return;

    if (player.buildingMaterial > 0) {
      player.buildingMaterial--;

      const distance = 100;

      // Konvertera rotation till radianer
      const rad = player.rotate * (Math.PI / 180);

      // Hitta **mittpunkten** där väggen ska hamna (centerX/Y)
      let centerX = player.x + player.width / 2 + Math.cos(rad) * distance;
      let centerY = player.y + player.height / 2 + Math.sin(rad) * distance;

      // Skapa unik wall ID
      const wallId = id + 'Wall' + Date.now();

      const wallWidth = 200;
      const wallHeight = 20;
      const wallRotation = player.rotate - 90;  // Spara rotationen här för att använda i clamp

      // **NY DEL: Beräkna AABB (Axis-Aligned Bounding Box) för den roterade väggen**
      const theta = wallRotation * (Math.PI / 180);
      const absCos = Math.abs(Math.cos(theta));
      const absSin = Math.abs(Math.sin(theta));

      // AABB-storlekar efter rotation
      const aabbWidth = wallWidth * absCos + wallHeight * absSin;
      const aabbHeight = wallWidth * absSin + wallHeight * absCos;

      // **CLAMP CENTRUM så att HELA väggen ryms inom 0 -> WORLD_SIZE**
      const halfAabbW = aabbWidth / 2;
      const halfAabbH = aabbHeight / 2;

      const clampedCenterX = Math.max(halfAabbW, Math.min(centerX, WORLD_SIZE - halfAabbW));
      const clampedCenterY = Math.max(halfAabbH, Math.min(centerY, WORLD_SIZE - halfAabbH));

      // **Sätt top-left pos baserat på CLAMPAT CENTRUM**
      const wallPosX = clampedCenterX - wallWidth / 2;
      const wallPosY = clampedCenterY - wallHeight / 2;

      // **Extra säkerhetscheck: Om väggen skulle klippas för mycket (>50% utanför), bygg inte alls**
      const clampAmountX = Math.abs(centerX - clampedCenterX);
      const clampAmountY = Math.abs(centerY - clampedCenterY);
      if (clampAmountX > distance * 0.5 || clampAmountY > distance * 0.5) {
        // Återställ material (valfritt, för fairness)
        player.buildingMaterial++;
        return;  // Bygg inte
      }

      const wall = {
        id: wallId,
        owner: id,
        pos: { 
          x: wallPosX,
          y: wallPosY
        },
        rotation: wallRotation,
        width: wallWidth,
        height: wallHeight,
        health: 150
      };

      walls[wallId] = wall;
      io.emit("wall-created", wall);
    }
  });

});

// --- Fade på projektil ---
function fadeProjectile(projectile, duration) {
  if (projectile.fading) return;
  projectile.fading = true;
  io.emit('fadeProjectile', { id: projectile.projectileId, duration: duration });
  setTimeout(() => deleteProjectile(projectile.projectileId), duration);
}

// --- Ta bort projektil ---
function deleteProjectile(projectileId) {
  const index = projectiles.findIndex(p => p.projectileId === projectileId);
  if (index !== -1) {
    projectiles.splice(index, 1);
  }
  io.emit('projectileDeleted', projectileId);
}

// --- Main game loop ---
setInterval(() => {
  try {
    const deadPlayers = [];

    // Uppdatera positioner
    Object.values(players).forEach(player => {

      let vx = player.velocity.x;
      let vy = player.velocity.y;

      if (player.blockX) vx = 0;
      if (player.blockY) vy = 0;

      player.x += vx;
      player.y += vy;


      // --- Kollisioner med andra spelare (cirkelformad hitbox + balanserad putt-effekt) ---
      Object.values(players).forEach((otherPlayer) => {
        if (player.id === otherPlayer.id) return;

        const dx = (player.x + player.width / 2) - (otherPlayer.x + otherPlayer.width / 2);
        const dy = (player.y + player.height / 2) - (otherPlayer.y + otherPlayer.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        const radius1 = player.width / 2;
        const radius2 = otherPlayer.width / 2;
        const minDistance = radius1 + radius2;

        if (distance < minDistance && distance > 0) {
          const overlap = minDistance - distance;
          const nx = dx / distance;
          const ny = dy / distance;

          // 🔹 Putt-effekt: flytta isär båda spelarna lite
          const pushStrength = 0.5;
          player.x += nx * overlap * pushStrength;
          player.y += ny * overlap * pushStrength;
          otherPlayer.x -= nx * overlap * pushStrength;
          otherPlayer.y -= ny * overlap * pushStrength;

          // 🔹 Istället för att minska velocity varje gång, bromsa bara tillfälligt vid kollision
          const resistance = 0.3; // hur mycket rörelsen mot den andra bromsas
          const dot = player.velocity.x * nx + player.velocity.y * ny; // rörelse mot andra spelaren

          if (dot > 0) {
            // Ta bort lite av rörelsen *mot* den andra spelaren (men inte helt)
            player.velocity.x -= nx * dot * resistance;
            player.velocity.y -= ny * dot * resistance;
          }
        }
      });
    });
    
    // Uppdatera projektiler
    projectiles.forEach((projectile) => {
      projectile.pos.x += projectile.velocity.x;
      projectile.pos.y += projectile.velocity.y;

      // Kolla Bounce
      const projectileSize = 17
      const player = players[projectile.from];
      if (!player) return;
      if (player.x > 10 && player.x + player.width < 2990 && player.y > 10 && player.y + player.height < 2990) {     
        if (projectile.pos.x < 0 || projectile.pos.x + projectileSize > 3000) {
          if (!projectile.changedInterpolationValueX) {
            if (projectile.velocity.x > 13 || projectile.velocity.x < -13) {
              projectile.interpolationValueX = 32
              projectile.changedInterpolationValueX = true
            } else if (projectile.velocity.x < 1.5 && projectile.velocity.x > 0 || projectile.velocity.x > -1.5 && projectile.velocity.x < 0) {
              projectile.interpolationValueX = 5
              projectile.changedInterpolationValueX = true
            } else {
              projectile.interpolationValueX = 17
            }
          }
        } else if (projectile.pos.y < 0 || projectile.pos.y + projectileSize > 3000) {
          if (!projectile.changedInterpolationValueY) {
            if (projectile.velocity.y > 13 || projectile.velocity.x < -13) {
              projectile.interpolationValueY = 32
              projectile.changedInterpolationValueY = true
            } else if (projectile.velocity.y < 1.5 && projectile.velocity.y > 0 || projectile.velocity.y > -1.5 && projectile.velocity.y < 0) {
              projectile.interpolationValueY = 5
              projectile.changedInterpolationValueY = true
              console.log(projectile.velocity.y);
            } else {
              projectile.interpolationValueY = 17
            }
          }
        }
      } else {
        projectile.interpolationValueX = 17
        projectile.interpolationValueY = 17
      }
      
      if (projectile.pos.x < 0 - projectile.interpolationValueX || projectile.pos.x + projectileSize > 3000 + projectile.interpolationValueX) projectile.velocity.x = -projectile.velocity.x;
      if (projectile.pos.y < 0 - projectile.interpolationValueY || projectile.pos.y + projectileSize > 3000 + projectile.interpolationValueY) projectile.velocity.y = -projectile.velocity.y;

      // --- Projektil träffar vägg ---
      Object.values(walls).forEach(wall => {
        const projX = projectile.pos.x + projectile.width / 2;
        const projY = projectile.pos.y + projectile.height / 2;

        const wallCenterX = wall.pos.x + wall.width / 2;
        const wallCenterY = wall.pos.y + wall.height / 2;

        // Relativ position
        const relX = projX - wallCenterX;
        const relY = projY - wallCenterY;

        // Roterad koordinat i väggens lokala space
        const theta = (wall.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(-theta);
        const sin = Math.sin(-theta);

        const localX = relX * cos - relY * sin;
        const localY = relX * sin + relY * cos;

        const halfW = wall.width / 2;
        const halfH = wall.height / 2;

        // Kollisionscheck
        if (Math.abs(localX) < halfW && Math.abs(localY) < halfH) {

          // --- Skada väggen ---
          if (projectile.throughWall) return;

          wall.health -= 10;
          io.emit("wall-damaged", { id: wall.id, health: wall.health });
          projectile.throughWall = true

          // --- Om väggen går sönder ---
          if (wall.health <= 0) {
            delete walls[wall.id];
            io.emit("wall-destroyed", wall.id);
          }

          fadeProjectile(projectile, 100);

        }
      });

      // --- Kolla projektiler outofbounds ---

      if (projectile.pos.x < -projectile.interpolationValueX -20) {
        fadeProjectile(projectile, 100);
      } else if (projectile.pos.y < -projectile.interpolationValueY -20) {
        fadeProjectile(projectile, 100);
      } else if (projectile.pos.x + projectile.width > WORLD_SIZE + projectile.interpolationValueX +20) {
        fadeProjectile(projectile, 100);
      } else if (projectile.pos.y + projectile.height > WORLD_SIZE + projectile.interpolationValueY +20) {
        fadeProjectile(projectile, 100);
      }

      // Kolla kollisioner
      Object.values(players).forEach((player) => {
        if (!player) return;
        if (player.id === projectile.from) return;

          const projCenterX = projectile.pos.x + projectile.width / 2 - projectile.velocity.x * 1.8;
          const projCenterY = projectile.pos.y + projectile.height / 2 - projectile.velocity.y * 1.8;

          const delay = 4.2;
          const correction = projectile.width / 2 - 3;

          if (
            projCenterX > player.x - correction - player.velocity.x * delay &&
            projCenterX < player.x + player.width + correction - player.velocity.x * delay &&
            projCenterY > player.y - correction - player.velocity.y * delay &&
            projCenterY < player.y + player.height + correction - player.velocity.y * delay
          ) {
            if (!projectile.throughWall) {
              player.health -= 3;
            }

            if (player.health <= 0) {
              deadPlayers.push(player.id);
              if (players[projectile.from])
              ++players[projectile.from].kills;
              ++players[projectile.from].buildingMaterial;
              players[projectile.from].health += 20
              if (players[projectile.from].buildingMaterial > 3) {
                players[projectile.from].buildingMaterial = 3;
              }
              if (players[projectile.from].health > 60) {
                players[projectile.from].health = 60;
              }
            }

            fadeProjectile(projectile, 100);
          }
      });
    });

    //WALL -> PLayer
    Object.values(players).forEach(player => {
        if (!player) return;

        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;

        Object.values(walls).forEach(wall => {
            if (!wall) return;

            const wallCenterX = wall.pos.x + wall.width / 2;
            const wallCenterY = wall.pos.y + wall.height / 2;

            // Relative vector
            const relX = px - wallCenterX;
            const relY = py - wallCenterY;

            // Rotate into wall space (negative angle)
            const theta = (wall.rotation || 0) * (Math.PI / 180);
            const cos = Math.cos(-theta);
            const sin = Math.sin(-theta);

            // Player position in wall space
            const localX = relX * cos - relY * sin;
            const localY = relX * sin + relY * cos;

            // Half sizes
            const halfW = wall.width / 2;
            const halfH = wall.height / 2;
            const pW = player.width / 2;
            const pH = player.height / 2;

            const overlapX = (pW + halfW) - Math.abs(localX);
            const overlapY = (pH + halfH) - Math.abs(localY);

            // Collision?
            if (overlapX > 0 && overlapY > 0) {

                let pushLocal = { x: 0, y: 0 };

                // Push in the smallest overlap axis
                if (overlapX < overlapY) {
                    // Push sideways
                    pushLocal.x = (localX > 0) ? overlapX : -overlapX;
                    player.blockX = true;   // Block X movement this frame only
                } else {
                    // Push vertically
                    pushLocal.y = (localY > 0) ? overlapY : -overlapY;
                    player.blockY = true;   // Block Y movement this frame only
                }

                // Rotate push back to world space
                const cosB = Math.cos(theta);
                const sinB = Math.sin(theta);

                const pushWorldX = pushLocal.x * cosB - pushLocal.y * sinB;
                const pushWorldY = pushLocal.x * sinB + pushLocal.y * cosB;

                // Apply push
                player.x += pushWorldX;
                player.y += pushWorldY;
            }
        });
    });


    for (const player of Object.values(players)) {
        player.blockX = false;
        player.blockY = false;
    }


    // 🔹 Ta bort döda spelare efter loopen
    if (deadPlayers.length > 0) {
      deadPlayers.forEach(id => {
        const player = players[id];
        if (!player) return;
        io.to(id).emit("player-died");
        io.emit("remove-player", id);
        delete players[id];   
      });
    }

    // Skicka uppdateringar
    io.emit('players', players);
    io.emit('projectiles-positions', projectiles);
  } catch (err) {
    console.error("Fel i gameloop:", err);
    // fortsätt - nästa tick försöker igen
  }
}, 1000 / 30);

http.listen(port, () => {
  console.log(`Servern körs på http://localhost:${port}`);
});
