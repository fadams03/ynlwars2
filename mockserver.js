import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';

class MockServer {
    constructor(port = 3000) {
        this.app = express();
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        this.server = createServer(this.app);
        this.io = new Server(this.server, { cors: { origin: "*" } });

        // Erweiterter Spielzustand
        this.gameState = {
            players: {},
            projectiles: [],
            walls: [
                { x: 300, y: 200, width: 10, height: 400 },
                { x: 1200 - 10, y: 200, width: 10, height: 400 },
                { x: 700, y: 350, width: 10, height: 100 },
                { x: 800 - 10, y: 350, width: 10, height: 100 },
                { x: 700, y: 200, width: 100, height: 10 },
                { x: 700, y: 600 - 10, width: 100, height: 10 }
            ],
            flag: { x: 750, y: 400, carrier: null },
            score: { red: 0, blue: 0 },
            redSpawn: { x: 100, y: 400, width: 200, height: 200 },
            blueSpawn: { x: 1400, y: 400, width: 200, height: 200 },
            medikits: [],
            armors: [],
            chatMessages: []
        };

        this.setupRESTEndpoints();
        this.setupSocketHandlers();
        this.setupGameLoop();
        
        this.server.listen(port, () => console.log(`🎮 MockServer läuft auf Port ${port}`));
    }

    setupRESTEndpoints() {
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
            console.log(`👤 Verbunden: ${socket.id}`);

            socket.on('chooseTeam', ({ username, team }) => {
                const spawnX = team === 'red' ? this.gameState.redSpawn.x + 50 : this.gameState.blueSpawn.x + 50;
                const spawnY = team === 'red' ? this.gameState.redSpawn.y + 50 : this.gameState.blueSpawn.y + 50;
                
                this.gameState.players[socket.id] = {
                    id: socket.id,
                    username,
                    team,
                    x: spawnX,
                    y: spawnY,
                    health: 2,
                    armor: 0,
                    hasFlag: false,
                    kills: 0,
                    deaths: 0
                };
                console.log(`🎮 ${username} (${team}) ist beigetreten. Startposition: x:${spawnX}, y:${spawnY}`);
                this.broadcastState();
            });

            socket.on('move', (data) => {
                const player = this.gameState.players[socket.id];
                if (!player) return;

                const newX = player.x + data.dx;
                const newY = player.y + data.dy;

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
            });

            socket.on('shoot', ({ angle }) => {
                const player = this.gameState.players[socket.id];
                if (!player) return;

                this.gameState.projectiles.push({
                    id: `proj_${Date.now()}`,
                    x: player.x,
                    y: player.y,
                    vx: Math.cos(angle) * 5,
                    vy: Math.sin(angle) * 5,
                    owner: socket.id
                });

                this.broadcastState();
            });

            socket.on('disconnect', () => {
                if (this.gameState.players[socket.id]?.hasFlag) {
                    this.gameState.flag = { x: 750, y: 400, carrier: null };
                }
                delete this.gameState.players[socket.id];
                this.broadcastState();
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
        return !this.checkWallCollision(x, y) && this.checkBorderCollision(x, y);
    }

    checkWallCollision(x, y) {
        return this.gameState.walls.some(wall =>
            x - 10 < wall.x + wall.width &&
            x + 10 > wall.x &&
            y - 10 < wall.y + wall.height &&
            y + 10 > wall.y
        );
    }

    checkBorderCollision(x, y) {
        return x >= 10 && x <= 1490 && y >= 10 && y <= 790;
    }

    checkPlayerHit(projectile, player) {
        return Math.abs(projectile.x - player.x) < 20 && Math.abs(projectile.y - player.y) < 20;
    }

    handlePlayerHit(player, attackerId) {
        const attacker = this.gameState.players[attackerId];
        
        if (player.armor > 0) {
            player.armor--;
            console.log(`🎮 ${player.username} (${player.team}) wurde von ${attacker?.username || 'Unbekannt'} getroffen. Rüstung: ${player.armor}`);
        } else {
            player.health--;
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
                carrier: null
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
        if (!this.gameState.flag.carrier &&
            Math.abs(player.x - this.gameState.flag.x) < 20 &&
            Math.abs(player.y - this.gameState.flag.y) < 20) {
            
            player.hasFlag = true;
            this.gameState.flag.carrier = player.id;
            this.gameState.flag.x = player.x;
            this.gameState.flag.y = player.y;

            console.log(`🎮 ${player.username} (${player.team}) hat die Flagge aufgenommen!`);
        }
    }

    checkFlagScore(player) {
        const spawn = player.team === 'red' ? this.gameState.redSpawn : this.gameState.blueSpawn;
        
        if (player.hasFlag &&
            player.x > spawn.x &&
            player.x < spawn.x + spawn.width &&
            player.y > spawn.y &&
            player.y < spawn.y + spawn.height) {
            
            console.log(`🎮 ${player.username} (${player.team}) hat die Flagge zurückgebracht!`);
            this.gameState.score[player.team]++;
            player.hasFlag = false;
            this.gameState.flag = { x: 750, y: 400, carrier: null };

            console.log(`🎮 Neuer Punktestand - Rot: ${this.gameState.score.red}, Blau: ${this.gameState.score.blue}`);

            if (this.gameState.score[player.team] >= 3) {
                console.log(`🎮 Team ${player.team.toUpperCase()} hat das Spiel gewonnen!`);
                this.handleGameOver(player.team);
            }
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

        // Wähle zufälligen Spawn-Punkt
        const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
        
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
        this.gameState.flag = { x: 750, y: 400, carrier: null };
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
        // Prüfe Medikits
        this.gameState.medikits.forEach(item => {
            if (Math.abs(player.x - item.x) < 20 && Math.abs(player.y - item.y) < 20) {
                console.log(`🎮 ${player.username} (${player.team}) steht auf einem Medikit. Leben: ${player.health}/2`);
            }
        });

        // Prüfe Rüstungen
        this.gameState.armors.forEach(item => {
            if (Math.abs(player.x - item.x) < 20 && Math.abs(player.y - item.y) < 20) {
                console.log(`🎮 ${player.username} (${player.team}) steht auf einer Rüstung. Rüstung: ${player.armor}/2`);
            }
        });
    }
}

new MockServer();
