import { players, projectiles, chatMessages, score, flag, medikits, armors } from './gameState.js';
import { walls, redSpawn, blueSpawn, classes } from './gameConfig.js';
import { checkCollision, checkBorderCollision } from './collisionUtils.js';

export function setupSocketHandlers(io, gameState) {
    let gameStartTimeout = null;
    let gameStarted = false;

    io.on('connection', (socket) => {
        console.log('Neuer Spieler verbunden:', socket.id);
        socket.emit('chatUpdate', chatMessages);
        socket.emit('updateMedikits', medikits);
        socket.emit('updateArmors', armors);
        socket.emit('updateSpeedBoosters', gameState.speedBoosters);

        socket.on('chooseTeam', async (data) => {
            const { username, team, class: playerClass } = data || {};
        
            if (!username || !team || !playerClass) {
                console.error("❌ Fehler: `username`, `team` oder `class` ist undefined!", { username, team, playerClass });
                socket.emit('errorMessage', 'Fehlende Daten für Team-Auswahl.');
                return;
            }
        
            // Prüfe, ob das Spiel bereits läuft
            const gameIsRunning = Object.keys(players).length > 0 && (score.red > 0 || score.blue > 0);
            const isFlagAtSpawn = flag.x === 750 && flag.y === 400 && !flag.holder;
            const isFirstPlayer = Object.keys(players).length === 0;
            
            players[socket.id] = {
                x: team === 'red' ? redSpawn.x : blueSpawn.x,
                y: team === 'red' ? redSpawn.y : blueSpawn.y,
                team,
                username,
                hasFlag: false,
                health: 2,
                armor: 0,
                class: playerClass,
                lastShot: 0,
                speed: 5,
                canMove: false,
                canShoot: false,
                joinTime: Date.now()
            };

            console.log(`📢 ${username} ist Team ${team.toUpperCase()} als ${classes[playerClass].name} beigetreten!`);
            console.log(`🔍 Test: canMove ist ${players[socket.id].canMove}`);
            chatMessages.push(`📢 ${username} ist Team ${team.toUpperCase()} als ${classes[playerClass].name} beigetreten!`);
            io.emit('chatUpdate', chatMessages);
            io.emit('state', { players, projectiles, walls, flag, score, redSpawn, blueSpawn, medikits });

            // Starte oder setze den Countdown zurück
            if (isFirstPlayer || gameStartTimeout) {
                if (gameStartTimeout) {
                    clearTimeout(gameStartTimeout);
                }
                
                console.log("⏳ Spiel startet in 5 Sekunden ...");
                io.emit('countdown', 5);
                
                let countdown = 5;
                const countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        io.emit('countdown', countdown);
                    }
                }, 1000);

                gameStartTimeout = setTimeout(() => {
                    clearInterval(countdownInterval);
                    Object.keys(players).forEach(playerId => {
                        if (players[playerId]) {
                            players[playerId].canMove = true;
                            players[playerId].canShoot = true;
                        }
                    });
                    gameStarted = true;
                    io.emit('gameStarted');
                    io.emit('state', { players });
                    console.log("🎮 Spiel gestartet!");
                }, 5000);
            }
        });

        socket.on('move', (data) => {
            const player = players[socket.id];
            if (!player || !player.canMove) return;
        
            const playerClass = classes[player.class];
            let speedMultiplier = playerClass.speed / 3;
        
            if (player.speedBoostActive) speedMultiplier *= 1.1;
        
            const newX = player.x + data.dx * speedMultiplier;
            const newY = player.y + data.dy * speedMultiplier;
        
            if (
                !checkCollision(newX - 10, newY - 10, 20, 20, walls) &&
                checkBorderCollision(newX, newY, 20, 20)
            ) {
                player.x = newX;
                player.y = newY;
        
                // 👉 Nur das Nötigste senden
                socket.broadcast.emit('playerMoved', { id: socket.id, x: newX, y: newY });
            }
        
            handleFlagPickup(socket, player);
            handleFlagCapture(socket, player, io);
            handleMedikitPickup(socket, player, io);
            handleArmorPickup(socket, player, io);

            // Speed-Booster Logik
            gameState.speedBoosters.forEach(booster => {
                if (booster.active && Math.abs(player.x - booster.x) < 30 && Math.abs(player.y - booster.y) < 30) {
                    booster.active = false;
                    
                    if (!player.speedBoostActive) {
                        // Wenn kein Speed-Boost aktiv ist, aktiviere einen neuen
                        player.speedBoostActive = true;
                        setTimeout(() => {
                            if (players[socket.id]) {
                                players[socket.id].speedBoostActive = false;
                                io.to(socket.id).emit('speedBoostEnded');
                            }
                        }, 10000);
                        io.to(socket.id).emit('speedBoostActive', 10000);
                    } else {
                        // Wenn bereits ein Speed-Boost aktiv ist, setze nur die Zeit zurück
                        io.to(socket.id).emit('speedBoostActive', 10000);
                    }

                    io.emit('updateSpeedBoosters', gameState.speedBoosters);
                }
            });

        
            // Medikit / Armor / Booster bleiben erstmal wie sie sind
        });
        

        socket.on('chatMessage', (msg) => {
            if (!players[socket.id]) return;
            const message = `${players[socket.id].username}: ${msg}`;
            chatMessages.push(message);
            io.emit('chatUpdate', chatMessages);
        });

        socket.on('shoot', (data) => {
            const player = players[socket.id];
            if (!player || !player.canShoot) return; // Prüfe, ob der Spieler schießen darf

            const playerClass = classes[player.class];
            const now = Date.now();
            
            // Überprüfe Cooldown
            if (now - player.lastShot < playerClass.cooldown) {
                return;
            }

            // Erstelle Projektile basierend auf der Klasse
            for (let i = 0; i < playerClass.projectileCount; i++) {
                const useSpread = playerClass.projectileCount > 1 || playerClass.spread > 0;
                const spread = useSpread ? playerClass.spread : 0;
                const angle = data.angle + (Math.random() - 0.5) * spread;
            
                projectiles.push({
                    x: player.x,
                    y: player.y,
                    startX: player.x,
                    startY: player.y,
                    vx: Math.cos(angle) * playerClass.projectileSpeed,
                    vy: Math.sin(angle) * playerClass.projectileSpeed,
                    owner: socket.id,
                    damage: playerClass.damage,
                    class: player.class
                });
            }

            player.lastShot = now;
            io.emit('newProjectile', projectiles, walls);
        });


        socket.on('spawn', data => {
            const { username, team, playerClass } = data;
            const spawnPoint = team === 'red' ? redSpawn : blueSpawn;

            players[socket.id] = {
                id: socket.id,
                x: spawnPoint.x,
                y: spawnPoint.y,
                team,
                username,
                health: 100,
                armor: 0,
                class: playerClass,
                lastShot: 0,
                speed: 5,
                speedBoostActive: false
            };

            io.emit('playerJoined', { id: socket.id, username, team });
        });

        socket.on('disconnect', () => {
            if (players[socket.id]) {
                const player = players[socket.id];
                const leaveMessage = `❌ ${player.username} hat das Spiel verlassen.`;
                chatMessages.push(leaveMessage);
                io.emit('chatUpdate', chatMessages);

                // Wenn der Spieler die Flagge hat, lass sie an seiner Position fallen
                if (player.hasFlag) {
                    flag.x = player.x;
                    flag.y = player.y;
                    flag.holder = null;
                    io.emit('chatMessage', `🚩 ${player.username} hat die Flagge fallen gelassen!`);
                }

                delete players[socket.id];
            }
            console.log('Spieler getrennt:', socket.id);
            io.emit('state', { players, flag, score });
        });
    });
}

function handleFlagPickup(socket, player) {
    if (!flag.holder && Math.abs(player.x - flag.x) < 20 && Math.abs(player.y - flag.y) < 20) {
        flag.holder = socket.id;
        player.hasFlag = true;
        console.log(`🚩 ${player.username} hat die Flagge aufgenommen!`);
        socket.emit('chatMessage', `🚩 ${player.username} hat die Flagge aufgenommen!`);
    }
}

function handleFlagCapture(socket, player, io) {
    const spawn = player.team === 'red' ? redSpawn : blueSpawn;
    
    // Neue Koordinatenprüfung für die Basen
    if (player.hasFlag) {
        if (player.team === 'red') {
            if (player.x >= 50 && player.x <= 150 && player.y >= 345 && player.y <= 455) {
                score[player.team]++;
                console.log(`🏆 Punkt für Team ${player.team.toUpperCase()}`);

                // Setze Flagge auf unsichtbare Position
                flag.x = -100;
                flag.y = -100;
                flag.holder = null;
                player.hasFlag = false;

                io.emit('chatMessage', `🎉 ${player.username} hat einen Punkt für Team ${player.team.toUpperCase()} erzielt!`);

                // Starte Timer für das Flaggen-Spawning
                setTimeout(() => {
                    flag.x = 750;
                    flag.y = 400;
                    io.emit('chatMessage', `🚩 Die Flagge ist wieder verfügbar!`);
                    io.emit('state', { flag });
                }, 5000);

                if (score[player.team] === 3) {
                    io.emit('gameOver', player.team);
                    score.red = 0;
                    score.blue = 0;
                }
            }
        } else {
            if (player.x >= 1350 && player.x <= 1450 && player.y >= 345 && player.y <= 455) {
                score[player.team]++;
                console.log(`🏆 Punkt für Team ${player.team.toUpperCase()}`);

                // Setze Flagge auf unsichtbare Position
                flag.x = -100;
                flag.y = -100;
                flag.holder = null;
                player.hasFlag = false;

                io.emit('chatMessage', `🎉 ${player.username} hat einen Punkt für Team ${player.team.toUpperCase()} erzielt!`);

                // Starte Timer für das Flaggen-Spawning
                setTimeout(() => {
                    flag.x = 750;
                    flag.y = 400;
                    io.emit('chatMessage', `🚩 Die Flagge ist wieder verfügbar!`);
                    io.emit('state', { flag });
                }, 5000);

                if (score[player.team] === 3) {
                    io.emit('gameOver', player.team);
                    score.red = 0;
                    score.blue = 0;
                }
            }
        }
    }
}

function handleMedikitPickup(socket, player, io) {
    medikits.forEach(medikit => {
        if (medikit.active && Math.abs(player.x - medikit.x) < 10 && Math.abs(player.y - medikit.y) < 10) {
            if (player.health < 2) {
                player.health = 2;
                console.log(`❤️ ${player.username} hat sich geheilt!`);
                io.emit('chatMessage', `❤️ ${player.username} hat sich geheilt!`);
            }
            medikit.active = false;
            io.emit('updateMedikits', medikits);
        }
    });
}

function handleArmorPickup(socket, player, io) {
    armors.forEach(armor => {
        if (armor.active && Math.abs(player.x - armor.x) < 10 && Math.abs(player.y - armor.y) < 10) {
            if (player.armor === 0) {
                player.armor = 1;
                console.log(`🛡 ${player.username} hat Rüstung aufgenommen!`);
                io.emit('chatMessage', `🛡 ${player.username} hat Rüstung aufgenommen!`);
            }
            armor.active = false;
            io.emit('updateArmors', armors);
        }
    });
} 


