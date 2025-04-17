import { players, projectiles, flag, score } from './gameState.js';
import { checkCollision } from './collisionUtils.js';
import { walls, redSpawn, blueSpawn } from './gameConfig.js';
import { classes } from './gameConfig.js';

// Neue Funktion für präzise Kollisionserkennung
function checkProjectilePlayerCollision(projectile, player) {
    const PLAYER_WIDTH = 40;  // Spielerbreite
    const PLAYER_HEIGHT = 40; // Spielerhöhe
    const PROJECTILE_SIZE = 8; // Projektilgröße
    const FOOT_OFFSET = 10;   // Offset für die Füße

    // Berechne die Grenzen der Hitbox
    const playerLeft = player.x - PLAYER_WIDTH/2;
    const playerRight = player.x + PLAYER_WIDTH/2;
    const playerTop = player.y - PLAYER_HEIGHT/2;
    const playerBottom = player.y + PLAYER_HEIGHT/2 - FOOT_OFFSET; // Reduzierte Höhe an den Füßen

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

// Neue Funktion zum Überprüfen der Projektil-Distanz
function checkProjectileDistance(projectile) {
    const distance = Math.sqrt(
        Math.pow(projectile.x - projectile.startX, 2) + 
        Math.pow(projectile.y - projectile.startY, 2)
    );
    return distance <= classes[projectile.class].maxDistance;
}

// Aktualisiere die Projektile
export function updateProjectiles(io) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        
        // Aktualisiere Position
        proj.x += proj.vx;
        proj.y += proj.vy;

        // Prüfe Kollisionen mit Wänden
        if (checkCollision(proj.x - 4, proj.y - 4, 8, 8, walls)) {
            projectiles.splice(i, 1);
            continue;
        }

        // Prüfe Projektil-Distanz
        if (!checkProjectileDistance(proj)) {
            projectiles.splice(i, 1);
            continue;
        }

        // Prüfe Kollisionen mit Spielern
        for (const [id, player] of Object.entries(players)) {
            if (id !== proj.owner && checkProjectilePlayerCollision(proj, player)) {
                handleProjectileHit(player, proj, id, io);
                projectiles.splice(i, 1);
                break;
            }
        }
    }
}

// Setup-Funktion für das Projektil-System
export function setupProjectileSystem(io) {
    return setInterval(() => {
        updateProjectiles(io);
        // Sende nur die notwendigen Daten
        io.emit('state', { 
            players: Object.fromEntries(
                Object.entries(players).map(([id, player]) => [
                    id,
                    {
                        x: player.x,
                        y: player.y,
                        health: player.health,
                        armor: player.armor,
                        hasFlag: player.hasFlag,
                        team: player.team,
                        speedBoostActive: player.speedBoostActive,
                        username: player.username
                    }
                ])
            ),
            projectiles: projectiles.map(proj => ({
                x: proj.x,
                y: proj.y,
                class: proj.class
            })),
            walls: walls,
            flag: {
                x: flag.x,
                y: flag.y,
                holder: flag.holder
            },
            score: score
        });
    }, 1000/30);
}

function handleProjectileHit(player, proj, id, io) {
    let damage = proj.damage || 1; // Standard-Schaden ist 1, falls nicht definiert

    // Berechne Distanzschaden
    const distance = Math.sqrt(
        Math.pow(proj.x - proj.startX, 2) + 
        Math.pow(proj.y - proj.startY, 2)
    );
    const maxDistance = classes[proj.class].maxDistance;
    const minDamage = classes[proj.class].minDamage;
    
    // Lineare Abnahme des Schadens mit der Distanz und Runden auf ganze Zahlen
    damage = Math.round(Math.max(
        minDamage,
        damage * (1 - (distance / maxDistance))
    ));

    if (player.armor > 0) {
        player.armor -= damage;
        if (player.armor < 0) {
            player.health += player.armor;
            player.armor = 0;
        }
        console.log(`🛡 ${player.username} wurde getroffen! Rüstung: ${player.armor}, Leben: ${player.health}`);
        io.emit('chatMessage', `🛡 ${player.username} wurde getroffen! Rüstung: ${player.armor}, Leben: ${player.health}`);
    } else {
        player.health -= damage;
        console.log(`🔥 ${player.username} wurde getroffen! Leben: ${player.health}`);
        io.emit('chatMessage', `🔥 ${player.username} wurde getroffen! Leben: ${player.health}`);
    }

    if (player.health <= 0) {
        handlePlayerDeath(player, proj, io);
    }
}

function handlePlayerDeath(player, proj, io) {
    console.log(`💀 ${player.username} wurde eliminiert!`);
    io.emit('chatMessage', `💀 ${player.username} wurde eliminiert!`);

    player.x = player.team === 'red' ? redSpawn.x + 50 : blueSpawn.x + 50;
    player.y = player.team === 'red' ? redSpawn.y + 50 : blueSpawn.y + 50;
    player.health = 2;
    player.armor = 0;

    if (player.hasFlag) {
        flag.x = proj.x;
        flag.y = proj.y;
        flag.holder = null;
        player.hasFlag = false;
    }
} 