import { jest } from '@jest/globals';
import { setupSocketHandlers } from './socketHandlers';
import { players, projectiles, chatMessages, score, flag, medikits, armors } from './gameState';
import { walls, redSpawn, blueSpawn, classes } from './gameConfig';

describe('Socket Handlers', () => {
    let mockSocket;
    let mockIo;
    let gameState;
    let eventHandlers;

    beforeEach(() => {
        jest.useFakeTimers();
        
        eventHandlers = {};
        mockSocket = {
            id: 'test-socket-id',
            emit: jest.fn(),
            on: jest.fn((event, callback) => {
                eventHandlers[event] = callback;
            }),
            to: jest.fn().mockReturnThis(),
            join: jest.fn(),
            leave: jest.fn()
        };
        
        mockIo = {
            on: jest.fn((event, callback) => {
                if (event === 'connection') {
                    callback(mockSocket);
                }
            }),
            emit: jest.fn(),
            to: jest.fn().mockReturnThis(),
            sockets: {
                sockets: new Map([[mockSocket.id, mockSocket]])
            }
        };
        
        gameState = {
            speedBoosters: [],
            medikits: [{ x: 100, y: 100, active: true }],
            armors: [{ x: 200, y: 200, active: true }]
        };

        // Reset des Spielzustands
        Object.keys(players).forEach(key => delete players[key]);
        projectiles.length = 0;
        chatMessages.length = 0;
        score.red = 0;
        score.blue = 0;
        flag.x = 750;
        flag.y = 400;
        flag.holder = null;
        medikits.forEach(m => m.active = true);
        armors.forEach(a => a.active = true);

        console.log = jest.fn();
        console.error = jest.fn();
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    describe('Verbindung und Initialisierung', () => {
        it('sollte initiale Daten beim Verbinden senden', () => {
            setupSocketHandlers(mockIo, gameState);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('chatUpdate', chatMessages);
            expect(mockSocket.emit).toHaveBeenCalledWith('updateMedikits', medikits);
            expect(mockSocket.emit).toHaveBeenCalledWith('updateArmors', armors);
            expect(mockSocket.emit).toHaveBeenCalledWith('updateSpeedBoosters', gameState.speedBoosters);
            expect(console.log).toHaveBeenCalledWith('Neuer Spieler verbunden:', mockSocket.id);
        });

        it('sollte Spawn-Event verarbeiten', () => {
            setupSocketHandlers(mockIo, gameState);
            
            eventHandlers.spawn({
                username: 'TestUser',
                team: 'red',
                playerClass: 'classic'
            });

            expect(players[mockSocket.id]).toBeDefined();
            expect(players[mockSocket.id].x).toBe(redSpawn.x);
            expect(players[mockSocket.id].y).toBe(redSpawn.y);
            expect(mockIo.emit).toHaveBeenCalledWith('playerJoined', expect.any(Object));
        });
    });

    describe('Team-Auswahl', () => {
        it('sollte Spieler korrekt einem Team zuweisen', () => {
            setupSocketHandlers(mockIo, gameState);
            
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red',
                class: 'classic'
            });

            const player = players[mockSocket.id];
            expect(player).toBeDefined();
            expect(player.team).toBe('red');
            expect(player.username).toBe('TestUser');
            expect(player.class).toBe('classic');
            expect(player.health).toBe(2);
            expect(player.armor).toBe(0);
            expect(player.hasFlag).toBe(false);
            expect(player.speed).toBe(5);
            expect(player.canMove).toBe(false);
            expect(player.canShoot).toBe(false);
            expect(player.x).toBe(redSpawn.x);
            expect(player.y).toBe(redSpawn.y);
            expect(player.joinTime).toBeDefined();
        });

        it('sollte Fehler bei ungültigen Daten abfangen', () => {
            setupSocketHandlers(mockIo, gameState);
            
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red'
            });

            expect(players[mockSocket.id]).toBeUndefined();
            expect(console.error).toHaveBeenCalled();
        });

        it('sollte Countdown für ersten Spieler starten', () => {
            setupSocketHandlers(mockIo, gameState);
            
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red',
                class: 'classic'
            });

            expect(players[mockSocket.id].canMove).toBe(false);
            expect(players[mockSocket.id].canShoot).toBe(false);

            jest.advanceTimersByTime(5000);

            expect(players[mockSocket.id].canMove).toBe(true);
            expect(players[mockSocket.id].canShoot).toBe(true);
        });

        it('sollte zweiten Spieler sofort spielen lassen', () => {
            setupSocketHandlers(mockIo, gameState);
            
            // Erster Spieler
            eventHandlers.chooseTeam({
                username: 'TestUser1',
                team: 'red',
                class: 'classic'
            });

            // Zweiter Spieler
            const mockSocket2 = { ...mockSocket, id: 'test-socket-id-2' };
            const eventHandlers2 = {};
            mockSocket2.on = jest.fn((event, callback) => {
                eventHandlers2[event] = callback;
            });
            mockIo.on.mock.calls[0][1](mockSocket2);

            eventHandlers2.chooseTeam({
                username: 'TestUser2',
                team: 'blue',
                class: 'classic'
            });

            expect(players[mockSocket2.id].canMove).toBe(true);
            expect(players[mockSocket2.id].canShoot).toBe(true);
        });
    });

    describe('Bewegung und Kollisionen', () => {
        beforeEach(() => {
            setupSocketHandlers(mockIo, gameState);
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red',
                class: 'classic'
            });
            jest.advanceTimersByTime(5000);
            players[mockSocket.id].canMove = true;
        });

        it('sollte Spielerbewegung mit Speed-Boost verarbeiten', () => {
            players[mockSocket.id].speedBoostActive = true;
            const initialX = players[mockSocket.id].x;

            eventHandlers.move({ dx: 1, dy: 0 });

            expect(players[mockSocket.id].x).not.toBe(initialX);
            expect(players[mockSocket.id].speedBoostActive).toBe(true);
        });

        it('sollte Speed-Booster-Pickup verarbeiten', () => {
            gameState.speedBoosters = [{ x: 100, y: 100, active: true }];
            players[mockSocket.id].x = 100;
            players[mockSocket.id].y = 100;

            eventHandlers.move({ dx: 0, dy: 0 });

            expect(players[mockSocket.id].speedBoostActive).toBe(true);
            expect(gameState.speedBoosters[0].active).toBe(false);
            expect(mockIo.to(mockSocket.id).emit).toHaveBeenCalledWith('speedBoostActive', 20000);

            jest.advanceTimersByTime(20000);
            expect(players[mockSocket.id].speedBoostActive).toBe(false);
        });

        it('sollte Speed-Booster-Zeit verlängern', () => {
            gameState.speedBoosters = [{ x: 100, y: 100, active: true }];
            players[mockSocket.id].x = 100;
            players[mockSocket.id].y = 100;
            players[mockSocket.id].speedBoostActive = true;

            eventHandlers.move({ dx: 0, dy: 0 });

            expect(players[mockSocket.id].speedBoostActive).toBe(true);
            expect(mockIo.to(mockSocket.id).emit).toHaveBeenCalledWith('speedBoostActive', 20000);
        });

        it('sollte Medikit-Pickup verarbeiten', () => {
            players[mockSocket.id].x = gameState.medikits[0].x;
            players[mockSocket.id].y = gameState.medikits[0].y;
            players[mockSocket.id].health = 50;

            eventHandlers.move({ dx: 0, dy: 0 });

            expect(players[mockSocket.id].health).toBe(100);
            expect(gameState.medikits[0].active).toBe(false);
        });

        it('sollte Rüstungs-Pickup verarbeiten', () => {
            players[mockSocket.id].x = gameState.armors[0].x;
            players[mockSocket.id].y = gameState.armors[0].y;
            players[mockSocket.id].armor = 50;

            eventHandlers.move({ dx: 0, dy: 0 });

            expect(players[mockSocket.id].armor).toBe(100);
            expect(gameState.armors[0].active).toBe(false);
        });
    });

    describe('Schüsse und Projektile', () => {
        beforeEach(() => {
            setupSocketHandlers(mockIo, gameState);
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red',
                class: 'classic'
            });
            jest.advanceTimersByTime(5000);
            players[mockSocket.id].canShoot = true;
        });

        it('sollte mehrere Projektile für Shotgun verarbeiten', () => {
            players[mockSocket.id].class = 'shotgun';
            eventHandlers.shoot({ angle: 0 });

            expect(projectiles.length).toBeGreaterThan(1);
            projectiles.forEach(proj => {
                expect(proj.owner).toBe(mockSocket.id);
                expect(proj.class).toBe('shotgun');
            });
        });

        it('sollte Cooldown für verschiedene Klassen berücksichtigen', () => {
            players[mockSocket.id].class = 'sniper';
            eventHandlers.shoot({ angle: 0 });
            const initialProjectileCount = projectiles.length;
            eventHandlers.shoot({ angle: 0 });

            expect(projectiles.length).toBe(initialProjectileCount);
        });
    });

    describe('Flaggen-System', () => {
        beforeEach(() => {
            setupSocketHandlers(mockIo, gameState);
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red',
                class: 'classic'
            });
            jest.advanceTimersByTime(5000);
            players[mockSocket.id].canMove = true;
        });

        it('sollte Flagge nach Punktgewinn respawnen', () => {
            // Flagge aufnehmen
            players[mockSocket.id].x = flag.x;
            players[mockSocket.id].y = flag.y;
            eventHandlers.move({ dx: 0, dy: 0 });

            // Zur Basis bewegen und Punkt erzielen
            players[mockSocket.id].x = 100;
            players[mockSocket.id].y = 400;
            eventHandlers.move({ dx: 0, dy: 0 });

            expect(flag.x).toBe(-100);
            expect(flag.y).toBe(-100);

            jest.advanceTimersByTime(5000);

            expect(flag.x).toBe(750);
            expect(flag.y).toBe(400);
            expect(mockIo.emit).toHaveBeenCalledWith('chatMessage', expect.stringContaining('Die Flagge ist wieder verfügbar'));
        });

        it('sollte Spielende und Reset nach 3 Punkten durchführen', () => {
            for (let i = 0; i < 3; i++) {
                players[mockSocket.id].x = flag.x;
                players[mockSocket.id].y = flag.y;
                eventHandlers.move({ dx: 0, dy: 0 });

                players[mockSocket.id].x = 100;
                players[mockSocket.id].y = 400;
                eventHandlers.move({ dx: 0, dy: 0 });

                if (i < 2) {
                    flag.x = 750;
                    flag.y = 400;
                    flag.holder = null;
                }
            }

            expect(mockIo.emit).toHaveBeenCalledWith('gameOver', 'red');
            expect(score.red).toBe(0);
            expect(score.blue).toBe(0);
        });
    });

    describe('Chat-System', () => {
        beforeEach(() => {
            setupSocketHandlers(mockIo, gameState);
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red',
                class: 'classic'
            });
        });

        it('sollte Chat-Nachrichten ignorieren wenn Spieler nicht existiert', () => {
            delete players[mockSocket.id];
            eventHandlers.chatMessage('Test Nachricht');
            expect(chatMessages.length).toBe(1);
        });

        it('sollte System-Nachrichten verarbeiten', () => {
            eventHandlers.chatMessage('Test System Nachricht');
            expect(chatMessages[1]).toBe('TestUser: Test System Nachricht');
        });
    });

    describe('Verbindungstrennung', () => {
        beforeEach(() => {
            setupSocketHandlers(mockIo, gameState);
            eventHandlers.chooseTeam({
                username: 'TestUser',
                team: 'red',
                class: 'classic'
            });
        });

        it('sollte Trennung ohne Flagge verarbeiten', () => {
            eventHandlers.disconnect();
            expect(players[mockSocket.id]).toBeUndefined();
            expect(chatMessages[1]).toContain('hat das Spiel verlassen');
            expect(console.log).toHaveBeenCalledWith('Spieler getrennt:', mockSocket.id);
        });

        it('sollte Trennung mit Flagge verarbeiten', () => {
            players[mockSocket.id].hasFlag = true;
            flag.holder = mockSocket.id;
            players[mockSocket.id].x = 300;
            players[mockSocket.id].y = 300;

            eventHandlers.disconnect();

            expect(flag.holder).toBe(null);
            expect(flag.x).toBe(300);
            expect(flag.y).toBe(300);
            expect(mockIo.emit).toHaveBeenCalledWith('chatMessage', expect.stringContaining('hat die Flagge fallen gelassen'));
        });

        it('sollte Trennung ohne Spieler verarbeiten', () => {
            delete players[mockSocket.id];
            eventHandlers.disconnect();
            expect(mockIo.emit).toHaveBeenCalledWith('state', expect.any(Object));
        });
    });
}); 