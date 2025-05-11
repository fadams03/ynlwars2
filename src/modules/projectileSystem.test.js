import { jest } from '@jest/globals';

// Mock für Socket.io
const mockIo = {
    emit: jest.fn()
};

// Mock für gameState
const mockPlayers = {};
const mockProjectiles = [];
const mockFlag = {
    x: 750,
    y: 400,
    holder: null
};
const mockScore = {
    red: 0,
    blue: 0
};

// Mock für gameConfig
const mockWalls = [
    { x: 100, y: 100, width: 50, height: 50 }
];
const mockRedSpawn = { x: 100, y: 100 };
const mockBlueSpawn = { x: 1400, y: 700 };
const mockClasses = {
    soldier: {
        maxDistance: 500,
        minDamage: 1
    }
};

// Mock für collisionUtils
const mockCheckCollision = jest.fn((x, y, width, height, walls) => {
    return walls.some(wall => 
        x < wall.x + wall.width &&
        x + width > wall.x &&
        y < wall.y + wall.height &&
        y + height > wall.y
    );
});

// Mock für die Module
jest.mock('./gameState.js', () => ({
    players: mockPlayers,
    projectiles: mockProjectiles,
    flag: mockFlag,
    score: mockScore
}));

jest.mock('./gameConfig.js', () => ({
    walls: mockWalls,
    redSpawn: mockRedSpawn,
    blueSpawn: mockBlueSpawn,
    classes: mockClasses
}));

jest.mock('./collisionUtils.js', () => ({
    checkCollision: mockCheckCollision
}));

// Importiere die zu testenden Funktionen
import { updateProjectiles, setupProjectileSystem } from './projectileSystem.js';

describe('Projektil-System', () => {
    beforeEach(() => {
        // Reset aller Mocks und Spielzustände
        jest.clearAllMocks();
        Object.keys(mockPlayers).forEach(key => delete mockPlayers[key]);
        mockProjectiles.length = 0;
        mockFlag.x = 750;
        mockFlag.y = 400;
        mockFlag.holder = null;
        mockScore.red = 0;
        mockScore.blue = 0;
    });

    describe('Projektil-Kollisionen', () => {
        test('sollte Projektil-Wand-Kollision erkennen', () => {
            mockProjectiles.push({
                x: mockWalls[0].x - 4,
                y: mockWalls[0].y,
                vx: 5,
                vy: 0,
                owner: 'player1',
                class: 'soldier',
                startX: mockWalls[0].x - 10,
                startY: mockWalls[0].y,
                damage: 2
            });

            updateProjectiles(mockIo);
            expect(mockProjectiles.length).toBe(0);
        });

        test('sollte Projektil-Spieler-Kollision erkennen', () => {
            mockPlayers['player1'] = {
                x: 100,
                y: 100,
                health: 2,
                armor: 0,
                team: 'red',
                username: 'TestPlayer1'
            };

            mockProjectiles.push({
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                owner: 'player2',
                class: 'soldier',
                startX: 90,
                startY: 100,
                damage: 2
            });

            updateProjectiles(mockIo);
            expect(mockProjectiles.length).toBe(0);
            expect(mockPlayers['player1'].health).toBe(1);
        });

        test('sollte Projektil-Distanz-Limit respektieren', () => {
            const maxDistance = mockClasses.soldier.maxDistance;
            mockProjectiles.push({
                x: maxDistance + 1,
                y: 0,
                vx: 5,
                vy: 0,
                owner: 'player1',
                class: 'soldier',
                startX: 0,
                startY: 0,
                damage: 2
            });

            updateProjectiles(mockIo);
            expect(mockProjectiles.length).toBe(0);
        });
    });

    describe('Schadensberechnung', () => {
        test('sollte Rüstung vor Leben schützen', () => {
            mockPlayers['player1'] = {
                x: 100,
                y: 100,
                health: 2,
                armor: 2,
                team: 'red',
                username: 'TestPlayer1'
            };

            mockProjectiles.push({
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                owner: 'player2',
                class: 'soldier',
                startX: 90,
                startY: 100,
                damage: 2
            });

            updateProjectiles(mockIo);
            expect(mockPlayers['player1'].armor).toBe(1);
            expect(mockPlayers['player1'].health).toBe(2);
        });

        test('sollte Distanzschaden korrekt berechnen', () => {
            mockPlayers['player1'] = {
                x: 200,
                y: 100,
                health: 2,
                armor: 0,
                team: 'red',
                username: 'TestPlayer1'
            };

            mockProjectiles.push({
                x: 200,
                y: 100,
                vx: 0,
                vy: 0,
                owner: 'player2',
                class: 'soldier',
                startX: 100,
                startY: 100,
                damage: 2
            });

            updateProjectiles(mockIo);
            expect(mockPlayers['player1'].health).toBe(1);
        });
    });

    describe('Spieler-Tod', () => {
        test('sollte Spieler korrekt respawnen', () => {
            mockPlayers['player1'] = {
                x: 100,
                y: 100,
                health: 1,
                armor: 0,
                team: 'red',
                username: 'TestPlayer1'
            };

            mockProjectiles.push({
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                owner: 'player2',
                class: 'soldier',
                startX: 90,
                startY: 100,
                damage: 2
            });

            updateProjectiles(mockIo);
            expect(mockPlayers['player1'].health).toBe(2);
            expect(mockPlayers['player1'].x).toBe(mockRedSpawn.x + 50);
            expect(mockPlayers['player1'].y).toBe(mockRedSpawn.y + 50);
        });

        test('sollte Flagge fallen lassen beim Tod', () => {
            mockPlayers['player1'] = {
                x: 100,
                y: 100,
                health: 1,
                armor: 0,
                team: 'red',
                username: 'TestPlayer1',
                hasFlag: true
            };

            mockFlag.holder = 'player1';

            mockProjectiles.push({
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                owner: 'player2',
                class: 'soldier',
                startX: 90,
                startY: 100,
                damage: 2
            });

            updateProjectiles(mockIo);
            expect(mockPlayers['player1'].hasFlag).toBe(false);
            expect(mockFlag.holder).toBe(null);
        });
    });

    describe('Setup und State-Updates', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('sollte regelmäßige State-Updates senden', () => {
            const interval = setupProjectileSystem(mockIo);
            
            mockPlayers['player1'] = {
                x: 100,
                y: 100,
                health: 2,
                armor: 0,
                team: 'red',
                username: 'TestPlayer1'
            };

            jest.advanceTimersByTime(1000/30);
            expect(mockIo.emit).toHaveBeenCalledWith('state', expect.any(Object));
            
            clearInterval(interval);
        });

        test('sollte nur notwendige Spieler-Daten senden', () => {
            mockPlayers['player1'] = {
                x: 100,
                y: 100,
                health: 2,
                armor: 0,
                team: 'red',
                username: 'TestPlayer1',
                hasFlag: false,
                speedBoostActive: false,
                lastShot: 0,
                fireRate: 1000,
                damage: 2
            };

            const interval = setupProjectileSystem(mockIo);
            jest.advanceTimersByTime(1000/30);

            const stateCall = mockIo.emit.mock.calls.find(call => call[0] === 'state');
            const playerData = stateCall[1].players['player1'];
            
            expect(playerData).toHaveProperty('x');
            expect(playerData).toHaveProperty('y');
            expect(playerData).toHaveProperty('health');
            expect(playerData).toHaveProperty('armor');
            expect(playerData).toHaveProperty('hasFlag');
            expect(playerData).toHaveProperty('team');
            expect(playerData).toHaveProperty('speedBoostActive');
            expect(playerData).toHaveProperty('username');
            
            // Prüfe, dass interne Daten nicht gesendet werden
            expect(playerData).not.toHaveProperty('lastShot');
            expect(playerData).not.toHaveProperty('fireRate');
            expect(playerData).not.toHaveProperty('damage');

            clearInterval(interval);
        });
    });
}); 