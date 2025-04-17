import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PORT, walls, redSpawn, blueSpawn } from './src/modules/gameConfig.js';
import { setupSocketHandlers } from './src/modules/socketHandlers.js';
import { setupProjectileSystem } from './src/modules/projectileSystem.js';
import { setupItemSystem } from './src/modules/itemSystem.js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config();


const app = express();
const server = createServer(app);
const io = new Server(server);
console.log("Zugangscode aus .env:", process.env.MASTER_zugangscode); 

app.use(express.static('public'));
app.use(express.json()); // wichtig für req.body

app.post('/verify-zugangscode', (req, res) => {
    const { zugangscode } = req.body;

    if (!zugangscode) {
        return res.status(400).json({ success: false, message: 'Kein Zugangscode übergeben' });
    }

    const masterzugangscode = process.env.MASTER_zugangscode;

    if (zugangscode === masterzugangscode) {
        return res.json({ success: true });
    } else {
        return res.status(401).json({ success: false, message: 'Falscher Zugangscode' });
    }
});



// gameState Definition
const gameState = {
    players: {},
    projectiles: [],
    walls: [],
    flag: {
        x: 800,
        y: 600,
        holder: null
    },
    score: {
        red: 0,
        blue: 0
    },
    redSpawn: { x: 100, y: 600 },
    blueSpawn: { x: 1500, y: 600 },
    medikits: [],
    armors: [],
    speedBoosters: [],
    lastSpeedBoosterSpawn: 0
};

// Neue Funktion für präzise Kollisionserkennung
function checkPlayerCollision(player, itemX, itemY) {
    const PLAYER_WIDTH = 40;  // Spielerbreite
    const PLAYER_HEIGHT = 40; // Spielerhöhe
    const ITEM_SIZE = 30;     // Größe der Items

    // Berechne die Grenzen der Hitbox
    const playerLeft = player.x - PLAYER_WIDTH/2;
    const playerRight = player.x + PLAYER_WIDTH/2;
    const playerTop = player.y - PLAYER_HEIGHT/2;
    const playerBottom = player.y + PLAYER_HEIGHT/2;

    // Berechne die Grenzen des Items
    const itemLeft = itemX - ITEM_SIZE/2;
    const itemRight = itemX + ITEM_SIZE/2;
    const itemTop = itemY - ITEM_SIZE/2;
    const itemBottom = itemY + ITEM_SIZE/2;

    // Prüfe Kollision
    return !(playerLeft > itemRight || 
             playerRight < itemLeft || 
             playerTop > itemBottom || 
             playerBottom < itemTop);
}

// Neue Funktion für Projektil-Spieler-Kollision
function checkProjectilePlayerCollision(projectile, player) {
    const PLAYER_WIDTH = 40;  // Spielerbreite
    const PLAYER_HEIGHT = 40; // Spielerhöhe
    const PROJECTILE_SIZE = 8; // Projektilgröße

    // Berechne die Grenzen der Hitbox
    const playerLeft = player.x - PLAYER_WIDTH/2;
    const playerRight = player.x + PLAYER_WIDTH/2;
    const playerTop = player.y - PLAYER_HEIGHT/2;
    const playerBottom = player.y + PLAYER_HEIGHT/2;

    // Berechne die Grenzen des Projektils
    const projectileLeft = projectile.x - PROJECTILE_SIZE/2;
    const projectileRight = projectile.x + PROJECTILE_SIZE/2;
    const projectileTop = projectile.y - PROJECTILE_SIZE/2;
    const projectileBottom = projectile.y + PROJECTILE_SIZE/2;

    // Prüfe Kollision
    return !(playerLeft > projectileRight || 
             playerRight < projectileLeft || 
             playerTop > projectileBottom || 
             playerBottom < projectileTop);
}

// GameLoop starten
setInterval(() => {
 

    // Überprüfe Speed-Booster-Spawn
    if (Date.now() - gameState.lastSpeedBoosterSpawn >= 60000) { // 60 Sekunden
        spawnSpeedBooster();
        gameState.lastSpeedBoosterSpawn = Date.now();
    }

    // Überprüfe Kollisionen mit Items für jeden Spieler
    Object.values(gameState.players).forEach(player => {

        // Speed-Booster-Aufsammeln
        gameState.speedBoosters.forEach(booster => {
            if (booster.active && checkPlayerCollision(player, booster.x, booster.y)) {
                booster.active = false;
                player.speed = (player.speed || 5) * 1.5;
                
                setTimeout(() => {
                    if (gameState.players[player.id]) {
                        gameState.players[player.id].speed /= 1.5;
                    }
                }, 20000);

                io.to(player.id).emit('speedBoostActive', 20000);
                io.emit('updateSpeedBoosters', gameState.speedBoosters);
            }
        });

        // Projektil-Kollisionen
        gameState.projectiles.forEach((projectile, index) => {
            if (projectile.owner !== player.id && checkProjectilePlayerCollision(projectile, player)) {
                // Treffer!
                player.health = Math.max(0, player.health - 1);
                if (player.health <= 0) {
                    respawnPlayer(player);
                }
                // Entferne das getroffene Projektil
                gameState.projectiles.splice(index, 1);
            }
        });
    });
}, 1000/30); // Reduziert auf 30 FPS

// Initialer Spawn von Items
spawnSpeedBooster();

// Socket.io Event-Handler einrichten
setupSocketHandlers(io, gameState);

// Projektilsystem starten
setupProjectileSystem(io, gameState);

// Item-Respawn-System starten
setupItemSystem(io, gameState);

// Neue Funktion zum Finden einer gültigen Position
function findValidPosition() {
    const SPAWN_BUFFER = 100; // Mindestabstand zu Spawnzonen
    let isValid = false;
    let x, y;

    while (!isValid) {
        x = Math.random() * 1600;
        y = Math.random() * 1200;
        isValid = true;

        // Prüfe Kollision mit Wänden
        for (const wall of walls) {
            if (x >= wall.x - 30 && x <= wall.x + wall.width + 30 &&
                y >= wall.y - 30 && y <= wall.y + wall.height + 30) {
                isValid = false;
                break;
            }
        }

        // Prüfe Abstand zu Spawnzonen
        const redDistance = Math.sqrt(
            Math.pow(x - redSpawn.x, 2) + 
            Math.pow(y - redSpawn.y, 2)
        );
        const blueDistance = Math.sqrt(
            Math.pow(x - blueSpawn.x, 2) + 
            Math.pow(y - blueSpawn.y, 2)
        );

        if (redDistance < SPAWN_BUFFER || blueDistance < SPAWN_BUFFER) {
            isValid = false;
        }

        // Prüfe, ob Position innerhalb des Spielfelds liegt
        if (x < 30 || x > 1570 || y < 30 || y > 1170) {
            isValid = false;
        }
    }

    return { x, y };
}


function spawnSpeedBooster() {
    const position = findValidPosition();
    const newBooster = {
        x: position.x,
        y: position.y,
        active: true
    };
    
    // Entferne alle alten Booster
    gameState.speedBoosters = [];
    
    // Füge neuen Booster hinzu
    gameState.speedBoosters.push(newBooster);
    io.emit('updateSpeedBoosters', gameState.speedBoosters);
}


server.listen(PORT, () => {
    console.log(`✅ Server läuft auf http://localhost:${PORT}`);
});

export { server, io, gameState };
