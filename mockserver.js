import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { walls, redSpawn, blueSpawn } from './src/modules/gameConfig.js';

class MockServer {
    constructor(port = 3000) {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        this.server = createServer(this.app);
        this.io = new Server(this.server, { cors: { origin: "*" } });

        // Mock gameState
        this.gameState = {
            players: {},
            projectiles: [],
            walls: walls,
            flag: {
                x: 750,  // Zentriert zwischen den mittleren Hindernissen
                y: 400,  // Zentriert zwischen den mittleren Hindernissen
                holder: null
            },
            score: {
                red: 0,
                blue: 0
            },
            redSpawn: redSpawn,
            blueSpawn: blueSpawn,
            medikits: [],
            armors: [],
            speedBoosters: [],
            lastSpeedBoosterSpawn: 0
        };

        this.setupRESTEndpoints();
        this.setupSocketHandlers();
        this.setupGameLoop();
        
        this.server.listen(port, () => console.log(`🎮 MockServer läuft auf Port ${port}`));
    }

    setupRESTEndpoints() {
        // Automatische Passwort-Akzeptierung
        this.app.post('/verify-zugangscode', (req, res) => {
            console.log('🔑 Mock: Zugangscode automatisch akzeptiert');
            return res.json({ success: true });
        });

        // Spieler-Management
        this.app.post('/api/players', (req, res) => {
            const { username, team } = req.body;
            const playerId = `player_${Date.now()}`;
            
            this.gameState.players[playerId] = {
                id: playerId,
                username,
                team,
                x: team === 'red' ? this.gameState.redSpawn.x + 50 : this.gameState.blueSpawn.x + 50,
                y: team === 'red' ? this.gameState.redSpawn.y + 50 : this.gameState.blueSpawn.y + 50,
                health: 2,
                armor: 0,
                hasFlag: false,
                kills: 0,
                deaths: 0
            };

            this.broadcastState();
            res.json({ playerId, player: this.gameState.players[playerId] });
        });

        this.app.get('/api/players', (_, res) => {
            res.json(this.gameState.players);
        });

        this.app.get('/api/players/:id', (req, res) => {
            const player = this.gameState.players[req.params.id];
            if (!player) return res.status(404).json({ error: 'Spieler nicht gefunden' });
            res.json(player);
        });

        // Bewegung und Aktionen
        this.app.post('/api/players/:id/move', (req, res) => {
            const { dx, dy } = req.body;
            const player = this.gameState.players[req.params.id];
            if (!player) return res.status(404).json({ error: 'Spieler nicht gefunden' });

            const newX = player.x + dx;
            const newY = player.y + dy;

            if (this.isValidMove(newX, newY)) {
                player.x = newX;
                player.y = newY;
                console.log(`🎮 ${player.username} (${player.team}) Position: x:${newX}, y:${newY}`);
                
                // Prüfe Items an aktueller Position
                this.checkItemPickup(player);
                
                if (player.hasFlag) {
                    this.gameState.flag.x = newX;
                    this.gameState.flag.y = newY;
                }

                this.checkFlagPickup(player);
                this.checkFlagScore(player);
            }

            this.broadcastState();
            res.json({ success: true, player });
        });

        this.app.post('/api/players/:id/shoot', (req, res) => {
            const { angle } = req.body;
            const player = this.gameState.players[req.params.id];
            if (!player) return res.status(404).json({ error: 'Spieler nicht gefunden' });

            const projectile = {
                id: `proj_${Date.now()}`,
                x: player.x,
                y: player.y,
                vx: Math.cos(angle) * 5,
                vy: Math.sin(angle) * 5,
                owner: req.params.id
            };

            this.gameState.projectiles.push(projectile);
            this.broadcastState();
            res.json({ success: true, projectile });
        });

        // Items und Power-ups
        this.app.post('/api/items/spawn', (req, res) => {
            const { type, x, y } = req.body;
            const item = {
                id: `item_${Date.now()}`,
                type,
                x,
                y,
                active: true
            };

            if (type === 'medikit') {
                this.gameState.medikits.push(item);
            } else if (type === 'armor') {
                this.gameState.armors.push(item);
            }

            this.broadcastState();
            res.json({ success: true, item });
        });

        // Neue API für Item-Aufnahme
        this.app.post('/api/players/:id/pickup', (req, res) => {
            const player = this.gameState.players[req.params.id];
            if (!player) return res.status(404).json({ error: 'Spieler nicht gefunden' });

            // Prüfe Medikits
            this.gameState.medikits = this.gameState.medikits.filter(item => {
                if (item.active && Math.abs(player.x - item.x) < 20 && Math.abs(player.y - item.y) < 20) {
                    player.health = Math.min(player.health + 1, 2);
                    console.log(`🎮 ${player.username} (${player.team}) hat ein Medikit aufgenommen. Leben: ${player.health}`);
                    
                    // Neues Medikit nach 5 Sekunden spawnen
                    setTimeout(() => this.spawnItem('medikit'), 5000);
                    return false;
                }
                return true;
            });

            // Prüfe Rüstungen
            this.gameState.armors = this.gameState.armors.filter(item => {
                if (item.active && Math.abs(player.x - item.x) < 20 && Math.abs(player.y - item.y) < 20) {
                    player.armor = Math.min(player.armor + 1, 2);
                    console.log(`🎮 ${player.username} (${player.team}) hat eine Rüstung aufgenommen. Rüstung: ${player.armor}`);
                    
                    // Neue Rüstung nach 5 Sekunden spawnen
                    setTimeout(() => this.spawnItem('armor'), 5000);
                    return false;
                }
                return true;
            });

            this.broadcastState();
            res.json({ success: true, player });
        });

        // Spielzustand
        this.app.get('/api/game/state', (_, res) => {
            res.json(this.gameState);
        });

        this.app.post('/api/game/reset', (_, res) => {
            this.resetGame();
            res.json({ success: true, gameState: this.gameState });
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Mock: Neuer Spieler verbunden:', socket.id);

            // Initiale Daten senden
            socket.emit('chatUpdate', []);
            socket.emit('updateMedikits', this.gameState.medikits);
            socket.emit('updateArmors', this.gameState.armors);
            socket.emit('updateSpeedBoosters', this.gameState.speedBoosters);

            // Team-Auswahl
            socket.on('chooseTeam', (data) => {
                const { username, team, class: playerClass } = data;
                
                if (!username || !team || !playerClass) {
                    socket.emit('errorMessage', 'Fehlende Daten für Team-Auswahl.');
                    return;
                }

                // Klassenspezifische Eigenschaften
                const classProperties = {
                    scout: { speed: 7, damage: 1, fireRate: 500 },
                    soldier: { speed: 5, damage: 2, fireRate: 1000 },
                    heavy: { speed: 3, damage: 3, fireRate: 1500 }
                };

                const properties = classProperties[playerClass] || classProperties.soldier;

                this.gameState.players[socket.id] = {
                    x: team === 'red' ? redSpawn.x : blueSpawn.x,
                    y: team === 'red' ? redSpawn.y : blueSpawn.y,
                    team,
                    username,
                    hasFlag: false,
                    health: 2,
                    armor: 0,
                    class: playerClass,
                    lastShot: 0,
                    speed: properties.speed,
                    damage: properties.damage,
                    fireRate: properties.fireRate,
                    canMove: true,
                    canShoot: true,
                    joinTime: Date.now()
                };

                this.io.emit('state', { 
                    players: this.gameState.players, 
                    projectiles: this.gameState.projectiles, 
                    walls: this.gameState.walls, 
                    flag: this.gameState.flag, 
                    score: this.gameState.score 
                });
            });

            // Bewegung
            socket.on('move', (data) => {
                const player = this.gameState.players[socket.id];
                if (!player || !player.canMove) return;

                const newX = player.x + data.dx * player.speed;
                const newY = player.y + data.dy * player.speed;

                // Prüfe Kollisionen vor der Bewegung
                if (this.isValidMove(newX, newY)) {
                    player.x = newX;
                    player.y = newY;

                    // Prüfe Item-Aufnahme
                    this.checkItemPickup(player);
                    
                    // Prüfe Flaggenaufnahme
                    this.checkFlagPickup(player);
                    
                    // Prüfe Flaggenrückgabe
                    this.checkFlagScore(player);

                    socket.broadcast.emit('playerMoved', { id: socket.id, x: newX, y: newY });
                }
            });

            // Schießen
            socket.on('shoot', (data) => {
                const player = this.gameState.players[socket.id];
                if (!player || !player.canShoot) return;

                const now = Date.now();
                if (now - player.lastShot < player.fireRate) return;
                player.lastShot = now;

                this.gameState.projectiles.push({
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(data.angle) * 10,
                    vy: Math.sin(data.angle) * 10,
                    owner: socket.id,
                    damage: player.damage
                });

                this.io.emit('newProjectile', this.gameState.projectiles);
            });

            // Trennung
            socket.on('disconnect', () => {
                if (this.gameState.players[socket.id]) {
                    delete this.gameState.players[socket.id];
                    this.io.emit('state', { 
                        players: this.gameState.players, 
                        flag: this.gameState.flag, 
                        score: this.gameState.score 
                    });
                }
            });
        });
    }

    setupGameLoop() {
        // Entferne den Timer-basierten Spawn
        setInterval(() => {
            // Projektile aktualisieren
            this.gameState.projectiles.forEach((proj, index) => {
                proj.x += proj.vx;
                proj.y += proj.vy;

                // Kollisionsprüfung mit Wänden
                if (this.checkWallCollision(proj.x, proj.y)) {
                    this.gameState.projectiles.splice(index, 1);
                    return;
                }

                // Kollisionsprüfung mit Spielern
                Object.entries(this.gameState.players).forEach(([id, player]) => {
                    if (proj.owner !== id && this.checkPlayerHit(proj, player)) {
                        this.handlePlayerHit(player, proj.owner);
                        this.gameState.projectiles.splice(index, 1);
                    }
                });
            });

            this.broadcastState();
        }, 1000/30); // Reduziert auf 30 FPS

        // Initial Items spawnen
        this.spawnInitialItems();
    }

    spawnInitialItems() {
        // Spawn je ein Medikit und eine Rüstung an festen Positionen
        const initialItems = [
            { type: 'medikit', x: 400, y: 400 },
            { type: 'armor', x: 1100, y: 400 }
        ];

        initialItems.forEach(itemConfig => {
            const item = {
                id: `item_${Date.now()}_${itemConfig.type}`,
                ...itemConfig,
                active: true,
                spawnTime: Date.now()
            };

            if (itemConfig.type === 'medikit') {
                this.gameState.medikits.push(item);
            } else {
                this.gameState.armors.push(item);
            }
        });
    }

    // Hilfsmethoden
    isValidMove(x, y) {
        // Prüfe Grenzen
        if (!this.checkBorderCollision(x, y)) return false;

        // Prüfe Wandkollisionen
        if (this.checkWallCollision(x, y)) return false;

        return true;
    }

    checkWallCollision(x, y) {
        const playerRadius = 15; // Spieler-Hitbox-Radius
        return this.gameState.walls.some(wall =>
            x - playerRadius < wall.x + wall.width &&
            x + playerRadius > wall.x &&
            y - playerRadius < wall.y + wall.height &&
            y + playerRadius > wall.y
        );
    }

    checkBorderCollision(x, y) {
        const playerRadius = 15;
        return x >= playerRadius && 
               x <= 1500 - playerRadius && 
               y >= playerRadius && 
               y <= 800 - playerRadius;
    }

    checkPlayerHit(projectile, player) {
        return Math.abs(projectile.x - player.x) < 20 && Math.abs(projectile.y - player.y) < 20;
    }

    handlePlayerHit(player, attackerId) {
        const attacker = this.gameState.players[attackerId];
        const projectile = this.gameState.projectiles.find(p => p.owner === attackerId);
        const damage = projectile ? projectile.damage : 1;
        
        if (player.armor > 0) {
            player.armor = Math.max(0, player.armor - damage);
            console.log(`🎮 ${player.username} (${player.team}) wurde von ${attacker?.username || 'Unbekannt'} getroffen. Rüstung: ${player.armor}`);
        } else {
            player.health = Math.max(0, player.health - damage);
            console.log(`🎮 ${player.username} (${player.team}) wurde von ${attacker?.username || 'Unbekannt'} getroffen. Leben: ${player.health}`);
        }

        if (player.health <= 0) {
            this.handlePlayerDeath(player, attacker);
        }
    }

    handlePlayerDeath(player, attacker) {
        player.deaths++;
        if (attacker) attacker.kills++;

        console.log(`🎮 ${player.username} (${player.team}) wurde von ${attacker?.username || 'Unbekannt'} eliminiert. Kills/Deaths: ${attacker?.kills || 0}/${player.deaths}`);

        if (player.hasFlag) {
            player.hasFlag = false;
            this.gameState.flag = {
                x: player.x,
                y: player.y,
                carrier: null,
                visible: true // Flagge wieder sichtbar machen
            };
            console.log(`🎮 ${player.username} (${player.team}) hat die Flagge fallen gelassen!`);
        }

        this.respawnPlayer(player);
    }

    respawnPlayer(player) {
        const spawn = player.team === 'red' ? this.gameState.redSpawn : this.gameState.blueSpawn;
        player.x = spawn.x + 50;
        player.y = spawn.y + 50;
        player.health = 2;
        player.armor = 0;
    }

    checkFlagPickup(player) {
        const pickupRadius = 20;
        
        if (!this.gameState.flag.carrier &&
            Math.abs(player.x - this.gameState.flag.x) < pickupRadius &&
            Math.abs(player.y - this.gameState.flag.y) < pickupRadius) {
            
            // Prüfe, ob Spieler die gegnerische Flagge aufnimmt
            const flagTeam = this.gameState.flag.x < 750 ? 'blue' : 'red';
            if (player.team !== flagTeam) {
                player.hasFlag = true;
                this.gameState.flag.carrier = player.id;
                this.gameState.flag.x = player.x;
                this.gameState.flag.y = player.y;
                this.gameState.flag.visible = false; // Flagge unsichtbar machen

                console.log(`🎮 ${player.username} (${player.team}) hat die Flagge aufgenommen!`);
                this.broadcastState();
            }
        }
    }

    checkFlagScore(player) {
        if (!player.hasFlag) return;

        const spawn = player.team === 'red' ? this.gameState.redSpawn : this.gameState.blueSpawn;
        const spawnArea = {
            x: spawn.x,
            y: spawn.y,
            width: 200,
            height: 200
        };
        
        if (player.x >= spawnArea.x &&
            player.x <= spawnArea.x + spawnArea.width &&
            player.y >= spawnArea.y &&
            player.y <= spawnArea.y + spawnArea.height) {
            
            console.log(`🎮 ${player.username} (${player.team}) hat die Flagge zurückgebracht!`);
            this.gameState.score[player.team]++;
            player.hasFlag = false;
            
            // Flagge zurück zur Mitte
            this.gameState.flag = { 
                x: 750, 
                y: 400, 
                carrier: null,
                visible: true // Flagge wieder sichtbar machen
            };

            console.log(`🎮 Neuer Punktestand - Rot: ${this.gameState.score.red}, Blau: ${this.gameState.score.blue}`);

            if (this.gameState.score[player.team] >= 3) {
                console.log(`🎮 Team ${player.team.toUpperCase()} hat das Spiel gewonnen!`);
                this.handleGameOver(player.team);
            }

            this.broadcastState();
        }
    }

    handleGameOver(winningTeam) {
        this.io.emit('gameOver', {
            winner: winningTeam,
            score: this.gameState.score
        });

        setTimeout(() => this.resetGame(), 5000);
    }

    spawnItem(type) {
        // Definiere mögliche Spawn-Positionen
        const spawnPoints = [
            { x: 400, y: 400 },   // Links von der Mitte
            { x: 1100, y: 400 },  // Rechts von der Mitte
            { x: 750, y: 200 },   // Oben Mitte
            { x: 750, y: 600 }    // Unten Mitte
        ];

        // Prüfe, ob ein Spawn-Punkt frei ist
        const isPositionOccupied = (x, y) => {
            const occupiedRadius = 30; // Mindestabstand zwischen Items
            
            // Prüfe Kollision mit anderen Items
            const allItems = [...this.gameState.medikits, ...this.gameState.armors];
            return allItems.some(item => 
                Math.abs(item.x - x) < occupiedRadius && 
                Math.abs(item.y - y) < occupiedRadius
            );
        };

        // Finde einen freien Spawn-Punkt
        let spawnPoint;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
            attempts++;
        } while (isPositionOccupied(spawnPoint.x, spawnPoint.y) && attempts < maxAttempts);

        // Wenn kein freier Punkt gefunden wurde, wähle einen zufälligen Punkt
        if (attempts >= maxAttempts) {
            spawnPoint = {
                x: Math.random() * 1200 + 150, // Zwischen 150 und 1350
                y: Math.random() * 600 + 100   // Zwischen 100 und 700
            };
        }
        
        const item = {
            id: `item_${Date.now()}`,
            type,
            x: spawnPoint.x,
            y: spawnPoint.y,
            active: true,
            spawnTime: Date.now()
        };

        if (type === 'medikit') {
            this.gameState.medikits.push(item);
            console.log(`🎮 Neues Medikit spawnt bei x:${spawnPoint.x}, y:${spawnPoint.y}`);
        } else if (type === 'armor') {
            this.gameState.armors.push(item);
            console.log(`🎮 Neue Rüstung spawnt bei x:${spawnPoint.x}, y:${spawnPoint.y}`);
        }

        this.broadcastState();
    }

    resetGame() {
        this.gameState.score = { red: 0, blue: 0 };
        this.gameState.flag = { 
            x: 750, 
            y: 400, 
            carrier: null,
            visible: true // Flagge sichtbar beim Spielstart
        };
        this.gameState.projectiles = [];
        this.gameState.medikits = [];
        this.gameState.armors = [];
        
        Object.values(this.gameState.players).forEach(player => {
            this.respawnPlayer(player);
            player.kills = 0;
            player.deaths = 0;
            player.hasFlag = false;
        });

        // Spawn initial items after reset
        this.spawnInitialItems();
        this.broadcastState();
    }

    broadcastState() {
        this.io.emit('state', this.gameState);
    }

    // Neue Methode für Item-Kollisionserkennung
    checkItemPickup(player) {
        const pickupRadius = 20;

        // Prüfe Medikits
        this.gameState.medikits = this.gameState.medikits.filter(item => {
            if (item.active && 
                Math.abs(player.x - item.x) < pickupRadius && 
                Math.abs(player.y - item.y) < pickupRadius) {
                
                if (player.health < 2) {
                    player.health = Math.min(player.health + 1, 2);
                    console.log(`🎮 ${player.username} (${player.team}) hat ein Medikit aufgenommen. Leben: ${player.health}`);
                    
                    // Neues Medikit nach 5 Sekunden spawnen
                    setTimeout(() => this.spawnItem('medikit'), 5000);
                    return false;
                }
            }
            return true;
        });

        // Prüfe Rüstungen
        this.gameState.armors = this.gameState.armors.filter(item => {
            if (item.active && 
                Math.abs(player.x - item.x) < pickupRadius && 
                Math.abs(player.y - item.y) < pickupRadius) {
                
                if (player.armor < 2) {
                    player.armor = Math.min(player.armor + 1, 2);
                    console.log(`🎮 ${player.username} (${player.team}) hat eine Rüstung aufgenommen. Rüstung: ${player.armor}`);
                    
                    // Neue Rüstung nach 5 Sekunden spawnen
                    setTimeout(() => this.spawnItem('armor'), 5000);
                    return false;
                }
            }
            return true;
        });

        this.broadcastState();
    }
}

const mockServer = new MockServer(3000);
