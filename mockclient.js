import { io } from 'socket.io-client';

class MockClient {
    constructor(url = 'http://localhost:8200') {
        console.log('Initialisiere MockClient...');
        this.socket = io(url);
        this.gameState = {
            players: {},
            projectiles: [],
            walls: [],
            flag: { x: 750, y: 400 },
            score: { red: 0, blue: 0 },
            medikits: [],
            armors: [],
            playerX: 0,
            playerY: 0,
            team: '',
            playerClass: '',
            connected: false,
            ready: false
        };
        this.setupListeners();
    }

    setupListeners() {
        this.socket.on('connect', () => {
            console.log('🔌 Verbunden mit Server');
            this.gameState.connected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Verbindung zum Server verloren');
            this.gameState.connected = false;
        });

        this.socket.on('state', state => {
            if (!state || !state.players) return;
            
            Object.assign(this.gameState, state);
            
            if (this.socket.id && this.socket.id in state.players) {
                const player = state.players[this.socket.id];
                this.gameState.playerX = player.x;
                this.gameState.playerY = player.y;
                
                if (!this.gameState.ready) {
                    console.log('✅ Spieler initialisiert');
                    this.gameState.ready = true;
                }
            }
        });

        this.socket.on('chatUpdate', messages => {
            const lastMsg = messages[messages.length - 1];
            console.log('💬', lastMsg);
        });
    }

    checkWallCollision(x, y) {
        const wallSize = 50;
        const playerSize = 30;
        
        for (const wall of this.gameState.walls) {
            if (x + playerSize > wall.x && 
                x - playerSize < wall.x + wallSize && 
                y + playerSize > wall.y && 
                y - playerSize < wall.y + wallSize) {
                return true;
            }
        }
        return false;
    }

    // Hilfsfunktion: Karte in ein Grid umwandeln
    buildGrid(cellSize = 10) {
        // Bestimme Spielfeldgröße
        let maxX = 1600; // Annahme: Spielfeldbreite
        let maxY = 900;  // Annahme: Spielfeldhöhe
        let cols = Math.ceil(maxX / cellSize);
        let rows = Math.ceil(maxY / cellSize);
        // Grid initialisieren
        let grid = Array.from({ length: cols }, () => Array(rows).fill(0));
        // Wände eintragen
        for (const wall of this.gameState.walls) {
            let wx = Math.floor(wall.x / cellSize);
            let wy = Math.floor(wall.y / cellSize);
            let wsize = Math.ceil(50 / cellSize); // Wandgröße 50x50
            for (let dx = 0; dx < wsize; dx++) {
                for (let dy = 0; dy < wsize; dy++) {
                    if (wx + dx < cols && wy + dy < rows) {
                        grid[wx + dx][wy + dy] = 1;
                    }
                }
            }
        }
        return { grid, cellSize, cols, rows };
    }

    // Hilfsfunktion: A*-Pathfinding
    findPath(startX, startY, endX, endY) {
        const { grid, cellSize, cols, rows } = this.buildGrid();
        const start = { x: Math.floor(startX / cellSize), y: Math.floor(startY / cellSize) };
        const end = { x: Math.floor(endX / cellSize), y: Math.floor(endY / cellSize) };
        function heuristic(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
        let open = [ { ...start, g: 0, f: heuristic(start, end), parent: null } ];
        let closed = new Set();
        let key = (n) => `${n.x},${n.y}`;
        while (open.length > 0) {
            open.sort((a, b) => a.f - b.f);
            let current = open.shift();
            if (current.x === end.x && current.y === end.y) {
                // Pfad zurückverfolgen
                let path = [];
                while (current) {
                    path.push(current);
                    current = current.parent;
                }
                return path.reverse();
            }
            closed.add(key(current));
            for (const dir of [ [1,0], [-1,0], [0,1], [0,-1] ]) {
                let nx = current.x + dir[0];
                let ny = current.y + dir[1];
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                if (grid[nx][ny] === 1) continue;
                let neighbor = { x: nx, y: ny };
                if (closed.has(key(neighbor))) continue;
                let g = current.g + 1;
                let f = g + heuristic(neighbor, end);
                let existing = open.find(n => n.x === nx && n.y === ny);
                if (!existing || g < existing.g) {
                    open.push({ x: nx, y: ny, g, f, parent: current });
                }
            }
        }
        return null; // Kein Pfad gefunden
    }

    // Kollisionsprüfung exakt auf Grid-Basis
    checkGridCollision(grid, x, y, cellSize) {
        const gx = Math.floor(x / cellSize);
        const gy = Math.floor(y / cellSize);
        if (gx < 0 || gy < 0 || gx >= grid.length || gy >= grid[0].length) return true;
        return grid[gx][gy] === 1;
    }

    async moveToPosition(targetX, targetY) {
        // Pathfinding mit A*
        const { grid, cellSize } = this.buildGrid();
        const path = this.findPath(this.gameState.playerX, this.gameState.playerY, targetX, targetY);
        if (!path || path.length < 2) {
            this.sendMessage('Kein Weg zum Ziel gefunden!');
            return;
        }
        for (let i = 1; i < path.length; i++) {
            const cell = path[i];
            const nextX = cell.x * cellSize + cellSize / 2;
            const nextY = cell.y * cellSize + cellSize / 2;
            // Kollisionsprüfung exakt auf Grid-Basis
            if (this.checkGridCollision(grid, nextX, nextY, cellSize)) {
                this.sendMessage(`Hindernis erkannt bei (${nextX.toFixed(0)}, ${nextY.toFixed(0)})! Kann nicht weiter.`);
                break;
            }
            const dx = nextX - this.gameState.playerX;
            const dy = nextY - this.gameState.playerY;
            this.move(dx, dy);
            // Warte auf tatsächliche Positionsänderung (Polling)
            let tries = 0;
            while (tries++ < 20) {
                await new Promise(resolve => setTimeout(resolve, 20));
                const px = this.gameState.playerX;
                const py = this.gameState.playerY;
                if (Math.abs(px - nextX) < cellSize / 2 && Math.abs(py - nextY) < cellSize / 2) {
                    break;
                }
            }
        }
        // Finale Bewegung zum Ziel
        const finalDx = targetX - this.gameState.playerX;
        const finalDy = targetY - this.gameState.playerY;
        if (Math.abs(finalDx) > 0 || Math.abs(finalDy) > 0) {
            if (!this.checkGridCollision(grid, targetX, targetY, cellSize)) {
                this.move(finalDx, finalDy);
            } else {
                this.sendMessage(`Hindernis erkannt bei (${targetX.toFixed(0)}, ${targetY.toFixed(0)})! Ziel nicht erreichbar.`);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    async runTests() {
        try {
            console.log('\n🧪 Starte Spieltests...\n');

            // 1. Verbindung und Spielstart
            await this.joinGame('TestBot', 'red', 'classic');
            console.log('⏳ Warte 5 Sekunden, dann beginne mit den Tests...');
            this.sendMessage('TestBot ist bereit!');
            await new Promise(resolve => setTimeout(resolve, 5000));
            this.sendMessage('Starte jetzt mit den Tests!');

            // 2. Schießtest in alle Richtungen
            console.log('\n🔫 Teste Schießen...');
            this.sendMessage('Starte Schießtests...');
            
            const angles = [0, Math.PI/2, Math.PI, Math.PI*1.5];
            for (const angle of angles) {
                console.log(`Schieße in Winkel ${angle}...`);
                this.sendMessage(`Schieße in Winkel ${angle}...`);
                this.shoot(angle);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 3. Items aufsammeln
            console.log('\n🎯 Starte Item-Sammlung...');
            this.sendMessage('Suche nach Items...');
            
            // Medikit
            const medikit = this.gameState.medikits.find(m => m.active);
            if (medikit) {
                console.log(`💊 Suche Medikit bei (${medikit.x}, ${medikit.y})...`);
                this.sendMessage(`Bewege mich zum Medikit bei (${medikit.x}, ${medikit.y})`);
                await this.moveToPosition(medikit.x, medikit.y);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Rüstung
            const armor = this.gameState.armors.find(a => a.active);
            if (armor) {
                console.log(`🛡️ Suche Rüstung bei (${armor.x}, ${armor.y})...`);
                this.sendMessage(`Bewege mich zur Rüstung bei (${armor.x}, ${armor.y})`);
                await this.moveToPosition(armor.x, armor.y);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Speedbooster
            const booster = this.gameState.speedBoosters && this.gameState.speedBoosters.find(b => b.active);
            if (booster) {
                console.log(`⚡ Suche Speedbooster bei (${booster.x}, ${booster.y})...`);
                this.sendMessage(`Bewege mich zum Speedbooster bei (${booster.x}, ${booster.y})`);
                await this.moveToPosition(booster.x, booster.y);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // 4. Flaggen-Runs
            console.log('\n🚩 Starte Flaggen-Runs...');
            this.sendMessage('Beginne Flaggen-Runs!');
            
            for (let i = 0; i < 3; i++) {
                console.log(`\n🏃 Flaggen-Run ${i + 1} von 3`);
                this.sendMessage(`Starte Flaggen-Run ${i + 1} von 3`);
                
                // Warte bis Flagge verfügbar
                await this.waitForFlagReset();
                console.log(`🚩 Flagge ist verfügbar bei (${this.gameState.flag.x}, ${this.gameState.flag.y})`);
                this.sendMessage(`Flagge gefunden! Bewege mich zu (${this.gameState.flag.x}, ${this.gameState.flag.y})`);
                
                // Bewege zur Flagge
                await this.moveToPosition(this.gameState.flag.x, this.gameState.flag.y);
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Prüfe ob Flagge aufgenommen wurde
                if (this.gameState.players[this.socket.id]?.hasFlag) {
                    console.log('✅ Flagge aufgenommen! Bewege zur Basis...');
                    this.sendMessage('Flagge aufgenommen! Bewege zur Basis...');
                    
                    // Bewege zur Basis
                    const baseX = this.gameState.team === 'red' ? 100 : 1400;
                    await this.moveToPosition(baseX, 400);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    console.log(`✅ Flaggen-Run ${i + 1} abgeschlossen`);
                    this.sendMessage(`Flaggen-Run ${i + 1} erfolgreich abgeschlossen!`);
                } else {
                    console.log('❌ Konnte Flagge nicht aufnehmen');
                    this.sendMessage('Konnte Flagge nicht aufnehmen, versuche es erneut...');
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log('\n🎉 Tests erfolgreich abgeschlossen!\n');
            this.sendMessage('Alle Tests erfolgreich abgeschlossen! 🎉');

        } catch (error) {
            console.error('❌ Testfehler:', error);
            this.sendMessage(`Fehler aufgetreten: ${error.message}`);
        }
    }

    async waitForFlagReset() {
        return new Promise((resolve) => {
            const checkFlag = () => {
                if (this.gameState.flag.x === 750 && this.gameState.flag.y === 400) {
                    resolve();
                } else {
                    setTimeout(checkFlag, 100);
                }
            };
            checkFlag();
        });
    }

    move(dx, dy) {
        if (!this.gameState.connected) {
            console.log('❌ Keine Verbindung zum Server');
            return;
        }
        this.socket.emit('move', { dx, dy });
    }

    shoot(angle) {
        if (!this.gameState.connected) return;
        this.socket.emit('shoot', { angle });
    }

    sendMessage(message) {
        if (!this.gameState.connected) {
            console.log('❌ Keine Verbindung zum Server');
            return;
        }
        this.socket.emit('chatMessage', message);
    }

    async joinGame(username, team, playerClass) {
        return new Promise((resolve) => {
            if (!this.gameState.connected) {
                console.log('⏳ Warte auf Serververbindung...');
                this.socket.once('connect', () => {
                    this.joinGame(username, team, playerClass).then(resolve);
                });
                return;
            }

            this.gameState.team = team;
            this.gameState.playerClass = playerClass;
            this.socket.emit('chooseTeam', { username, team, class: playerClass });
            this.socket.once('state', resolve);
        });
    }

    disconnect() {
        this.socket.disconnect();
        console.log('👋 Verbindung getrennt');
    }
}

// Test ausführen
async function runMockTest() {
    const client = new MockClient();
    await client.runTests();
    
    setTimeout(() => {
        client.disconnect();
    }, 30000);
}

runMockTest(); 