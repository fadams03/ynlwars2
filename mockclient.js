import { io } from 'socket.io-client';

class MockClient {
    constructor(url = 'http://localhost:8200') {
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
        this.lastLog = '';
        this.movementSpeed = 5;
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
            // Prüfe, ob state und state.players existieren
            if (!state || !state.players) {
                return;
            }

            const oldHealth = this.gameState.players[this.socket.id]?.health;
            const oldArmor = this.gameState.players[this.socket.id]?.armor;
            const oldHasFlag = this.gameState.players[this.socket.id]?.hasFlag;
            const oldScore = this.gameState.score;
            
            Object.assign(this.gameState, state);
            
            if (this.socket.id && this.socket.id in state.players) {
                this.gameState.playerX = state.players[this.socket.id].x;
                this.gameState.playerY = state.players[this.socket.id].y;
                const player = state.players[this.socket.id];

                if (!this.gameState.ready) {
                    console.log('✅ Spieler initialisiert');
                    this.gameState.ready = true;
                }
                
                if (oldHealth !== player.health) {
                    console.log(`❤️ Leben: ${player.health}`);
                }
                if (oldArmor !== player.armor) {
                    console.log(`🛡️ Rüstung: ${player.armor}`);
                }
                if (oldHasFlag !== player.hasFlag) {
                    console.log(player.hasFlag ? '🚩 Flagge aufgenommen!' : '🚩 Flagge verloren!');
                }
                if (state.score && (oldScore?.red !== state.score.red || oldScore?.blue !== state.score.blue)) {
                    console.log(`📊 Punktestand - Rot: ${state.score?.red || 0} | Blau: ${state.score?.blue || 0}`);
                }
            }
        });

        this.socket.on('chatUpdate', messages => {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg !== this.lastLog) {
                console.log('💬', lastMsg);
                this.lastLog = lastMsg;
            }
        });

        this.socket.on('updateMedikits', medikits => this.gameState.medikits = medikits);
        this.socket.on('updateArmors', armors => this.gameState.armors = armors);
        this.socket.on('gameOver', winner => console.log(`\n🏆 Spiel vorbei! Team ${winner} hat gewonnen!\n`));
    }

    async waitForReady() {
        return new Promise((resolve) => {
            if (this.gameState.ready) resolve();
            else {
                const interval = setInterval(() => {
                    if (this.gameState.ready) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    checkWallCollision(x, y) {
        return this.gameState.walls.some(wall =>
            x - 10 < wall.x + wall.width &&
            x + 10 > wall.x &&
            y - 10 < wall.y + wall.height &&
            y + 10 > wall.y
        );
    }

    async findPath(startX, startY, targetX, targetY) {
        const openSet = new Set();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const startKey = `${startX},${startY}`;
        const targetKey = `${targetX},${targetY}`;
        
        openSet.add(startKey);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startX, startY, targetX, targetY));
        
        let current = null;
        
        while (openSet.size > 0) {
            // Finde den Knoten mit dem niedrigsten fScore
            let lowestFScore = Infinity;
            for (const key of openSet) {
                const score = fScore.get(key) || Infinity;
                if (score < lowestFScore) {
                    lowestFScore = score;
                    current = key;
                }
            }
            
            if (!current) break;
            
            if (current === targetKey) {
                return this.reconstructPath(cameFrom, current);
            }
            
            openSet.delete(current);
            closedSet.add(current);
            
            const [currentX, currentY] = current.split(',').map(Number);
            
            // Prüfe alle 8 Richtungen
            const directions = [
                { dx: this.movementSpeed, dy: 0 },        // Rechts
                { dx: -this.movementSpeed, dy: 0 },       // Links
                { dx: 0, dy: this.movementSpeed },        // Unten
                { dx: 0, dy: -this.movementSpeed },       // Oben
                { dx: this.movementSpeed, dy: this.movementSpeed },    // Rechts-Unten
                { dx: -this.movementSpeed, dy: this.movementSpeed },   // Links-Unten
                { dx: this.movementSpeed, dy: -this.movementSpeed },   // Rechts-Oben
                { dx: -this.movementSpeed, dy: -this.movementSpeed }   // Links-Oben
            ];
            
            for (const dir of directions) {
                const neighborX = currentX + dir.dx;
                const neighborY = currentY + dir.dy;
                const neighborKey = `${neighborX},${neighborY}`;
                
                // Überspringe, wenn außerhalb der Karte oder in Hindernis
                if (this.checkWallCollision(neighborX, neighborY) || closedSet.has(neighborKey)) {
                    continue;
                }
                
                const tentativeGScore = (gScore.get(current) || 0) + 
                    this.distance(currentX, currentY, neighborX, neighborY);
                
                if (!openSet.has(neighborKey)) {
                    openSet.add(neighborKey);
                } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
                    continue;
                }
                
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + 
                    this.heuristic(neighborX, neighborY, targetX, targetY));
            }
        }
        
        // Wenn kein Pfad gefunden wurde, versuche einen direkten Weg
        return this.findDirectPath(startX, startY, targetX, targetY);
    }
    
    heuristic(x1, y1, x2, y2) {
        // Manhattan-Distanz für bessere Performance
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
    
    distance(x1, y1, x2, y2) {
        // Euklidische Distanz für genauere Pfadfindung
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
    
    reconstructPath(cameFrom, current) {
        const path = [];
        while (current) {
            const [x, y] = current.split(',').map(Number);
            path.unshift({ x, y });
            current = cameFrom.get(current);
        }
        return path;
    }
    
    async findDirectPath(startX, startY, targetX, targetY) {
        const path = [];
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(distance / this.movementSpeed);
        
        for (let i = 0; i < steps; i++) {
            const progress = i / steps;
            const nextX = startX + dx * progress;
            const nextY = startY + dy * progress;
            
            if (!this.checkWallCollision(nextX, nextY)) {
                path.push({ x: nextX, y: nextY });
            }
        }
        
        return path;
    }

    async moveToPosition(x, y) {
        const startX = this.gameState.playerX;
        const startY = this.gameState.playerY;
        
        // Finde optimalen Pfad
        const path = await this.findPath(startX, startY, x, y);
        
        // Bewege entlang des Pfades
        for (const point of path) {
            this.move(point.x - this.gameState.playerX, point.y - this.gameState.playerY);
            await new Promise(resolve => setTimeout(resolve, 50));
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

    async pickupFlag() {
        console.log(`🚩 Versuche Flagge bei (${this.gameState.flag.x}, ${this.gameState.flag.y}) aufzuheben...`);
        
        // Warte auf Flaggen-Reset
        await this.waitForFlagReset();
        
        // Bewege zur Flaggenposition
        await this.moveToPosition(this.gameState.flag.x, this.gameState.flag.y);
        
        // Kleine Bewegung um die Flagge
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            this.move(Math.cos(angle) * 5, Math.sin(angle) * 5);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Warte auf Flaggenaufnahme
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (this.gameState.players[this.socket.id]?.hasFlag) {
            console.log('✅ Flagge erfolgreich aufgenommen!');
            return true;
        }
        
        console.log('❌ Konnte Flagge nicht aufnehmen');
        return false;
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
        if (!this.gameState.connected) return;
        this.socket.emit('chatMessage', message);
    }

    async pickupItem(item, type) {
        console.log(`🎯 Versuche ${type} bei (${item.x}, ${item.y}) aufzusammeln...`);
        
        // Bewege zur Item-Position
        await this.moveToPosition(item.x, item.y);
        
        // Kleine Bewegung um das Item
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            this.move(Math.cos(angle) * 5, Math.sin(angle) * 5);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Prüfe, ob das Item aufgesammelt wurde
        if (!this.gameState[type].find(i => i.x === item.x && i.y === item.y && i.active)) {
            console.log(`✅ ${type} erfolgreich aufgesammelt!`);
            return true;
        }
        
        console.log(`❌ Konnte ${type} nicht aufsammeln`);
        return false;
    }

    async runTests() {
        try {
            console.log('\n🧪 Starte Spieltests...\n');

            // 1. Klasse auswählen und Team beitreten
            await this.joinGame('TestBot', 'red', 'classic');
            await this.waitForReady();
            console.log('🎮 Spiel bereit');

            // 2. Bewegungstest
            console.log('\n🏃 Teste Bewegungen...');
            const movements = [
                { dx: 30, dy: 0 }, { dx: 0, dy: 30 },
                { dx: -30, dy: 0 }, { dx: 0, dy: -30 }
            ];
            
            for (const move of movements) {
                this.move(move.dx, move.dy);
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // 3. Schießtest
            console.log('\n🔫 Teste Schießen...');
            for (const angle of [0, Math.PI/2, Math.PI, Math.PI*1.5]) {
                this.shoot(angle);
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // 4. Chat
            console.log('\n💬 Teste Chat...');
            this.sendMessage('Hallo, ich bin ein TestBot! 🤖');
            await new Promise(resolve => setTimeout(resolve, 500));

            // 5. Items und Flagge
            console.log('\n🎯 Starte Item-Tests...');
            
            // Ein Medikit
            const medikit = this.gameState.medikits.find(m => m.active);
            if (medikit) {
                await this.pickupItem(medikit, 'medikits');
            }

            // Eine Rüstung
            const armor = this.gameState.armors.find(a => a.active);
            if (armor) {
                await this.pickupItem(armor, 'armors');
            }

            // Flagge
            console.log('\n🚩 Starte Flaggen-Tests...');
            for (let i = 0; i < 3; i++) {
                if (await this.pickupFlag()) {
                    console.log('🚩 Flagge aufgenommen! Bewege zur Basis...');
                    const spawnX = this.gameState.team === 'red' ? 100 : 1400;
                    await this.moveToPosition(spawnX, 400);
                    
                    // Warte auf Punkt
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Kleine Bewegung in der Basis
                    for (let j = 0; j < 3; j++) {
                        this.move(0, 10);
                        await new Promise(resolve => setTimeout(resolve, 100));
                        this.move(0, -10);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    
                    console.log(`✅ Flaggen-Run ${i + 1} abgeschlossen`);
                }
                
                // Warte auf Flaggen-Reset
                await this.waitForFlagReset();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('\n🎉 Tests erfolgreich abgeschlossen!\n');

        } catch (error) {
            console.error('❌ Testfehler:', error);
        }
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
    }, 20000);
}

runMockTest(); 