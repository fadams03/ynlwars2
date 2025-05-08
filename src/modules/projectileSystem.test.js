import { jest } from '@jest/globals';
import { updateProjectiles, setupProjectileSystem } from './projectileSystem';
import { players, projectiles, flag, score } from './gameState';
import { walls, redSpawn, blueSpawn } from './gameConfig';
import { classes } from './gameConfig';

describe('Projectile System', () => {
    let mockIo;

    beforeEach(() => {
        // Reset der Mocks und des Zustands
        jest.useFakeTimers();
        mockIo = {
            emit: jest.fn()
        };
        Object.keys(players).forEach(key => delete players[key]);
        projectiles.length = 0;
        score.red = 0;
        score.blue = 0;
        flag.x = 750;
        flag.y = 400;
        flag.holder = null;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('updateProjectiles', () => {
        it('sollte Projektile bewegen', () => {
            const projectile = {
                x: 100,
                y: 100,
                vx: 1,
                vy: 1,
                startX: 100,
                startY: 100,
                class: 'classic',
                owner: 'player1'
            };
            projectiles.push(projectile);

            updateProjectiles(mockIo);

            expect(projectile.x).toBe(101);
            expect(projectile.y).toBe(101);
        });

        it('sollte Projektile bei Wandkollision entfernen', () => {
            const projectile = {
                x: walls[0].x,
                y: walls[0].y,
                vx: 0,
                vy: 0,
                startX: walls[0].x,
                startY: walls[0].y,
                class: 'classic',
                owner: 'player1'
            };
            projectiles.push(projectile);

            updateProjectiles(mockIo);

            expect(projectiles).toHaveLength(0);
        });

        it('sollte Projektile bei maximaler Distanz entfernen', () => {
            const maxDistance = classes.classic.maxDistance;
            const projectile = {
                x: maxDistance + 1,
                y: maxDistance + 1,
                vx: 0,
                vy: 0,
                startX: 0,
                startY: 0,
                class: 'classic',
                owner: 'player1'
            };
            projectiles.push(projectile);

            updateProjectiles(mockIo);

            expect(projectiles).toHaveLength(0);
        });

        it('sollte Spielerschaden bei Treffer berechnen', () => {
            const player = {
                x: 100,
                y: 100,
                health: 2,
                armor: 0,
                username: 'TestPlayer',
                team: 'red'
            };
            players['player2'] = player;

            const projectile = {
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                startX: 0,
                startY: 0,
                class: 'classic',
                owner: 'player1',
                damage: 1
            };
            projectiles.push(projectile);

            updateProjectiles(mockIo);

            expect(player.health).toBe(1);
            expect(projectiles).toHaveLength(0);
            expect(mockIo.emit).toHaveBeenCalledWith('chatMessage', expect.stringContaining('TestPlayer wurde getroffen!'));
        });

        it('sollte Rüstungsschaden bei Treffer berechnen', () => {
            const player = {
                x: 100,
                y: 100,
                health: 2,
                armor: 2,
                username: 'TestPlayer',
                team: 'red'
            };
            players['player2'] = player;

            const projectile = {
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                startX: 0,
                startY: 0,
                class: 'classic',
                owner: 'player1',
                damage: 1
            };
            projectiles.push(projectile);

            updateProjectiles(mockIo);

            expect(player.armor).toBe(1);
            expect(player.health).toBe(2);
            expect(projectiles).toHaveLength(0);
            expect(mockIo.emit).toHaveBeenCalledWith('chatMessage', expect.stringContaining('TestPlayer wurde getroffen!'));
        });

        it('sollte Spieler bei 0 Leben respawnen', () => {
            const player = {
                x: 100,
                y: 100,
                health: 1,
                armor: 0,
                username: 'TestPlayer',
                team: 'red',
                hasFlag: false
            };
            players['player2'] = player;

            const projectile = {
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                startX: 0,
                startY: 0,
                class: 'classic',
                owner: 'player1',
                damage: 2
            };
            projectiles.push(projectile);

            updateProjectiles(mockIo);

            expect(player.health).toBe(2);
            expect(player.armor).toBe(0);
            expect(player.x).toBe(redSpawn.x + 50);
            expect(player.y).toBe(redSpawn.y + 50);
            expect(mockIo.emit).toHaveBeenCalledWith('chatMessage', expect.stringContaining('TestPlayer wurde eliminiert!'));
        });

        it('sollte Flagge fallen lassen bei Spielertod', () => {
            const player = {
                x: 100,
                y: 100,
                health: 1,
                armor: 0,
                username: 'TestPlayer',
                team: 'red',
                hasFlag: true
            };
            players['player2'] = player;

            const projectile = {
                x: 100,
                y: 100,
                vx: 0,
                vy: 0,
                startX: 0,
                startY: 0,
                class: 'classic',
                owner: 'player1',
                damage: 2
            };
            projectiles.push(projectile);

            updateProjectiles(mockIo);

            expect(player.hasFlag).toBe(false);
            expect(flag.x).toBe(100);
            expect(flag.y).toBe(100);
            expect(flag.holder).toBe(null);
        });
    });

    describe('setupProjectileSystem', () => {
        it('sollte regelmäßige Updates senden', () => {
            const interval = setupProjectileSystem(mockIo);
            
            // Simuliere mehrere Updates
            jest.advanceTimersByTime(1000/30 * 3);

            // Überprüfe, ob Updates gesendet wurden
            expect(mockIo.emit).toHaveBeenCalledTimes(3);
            expect(mockIo.emit).toHaveBeenCalledWith('state', expect.any(Object));

            // Cleanup
            clearInterval(interval);
        });

        it('sollte nur notwendige Spielerdaten senden', () => {
            const player = {
                x: 100,
                y: 100,
                health: 2,
                armor: 1,
                hasFlag: false,
                team: 'red',
                speedBoostActive: false,
                username: 'TestPlayer'
            };
            players['player1'] = player;

            const interval = setupProjectileSystem(mockIo);
            jest.advanceTimersByTime(1000/30);

            const stateCall = mockIo.emit.mock.calls.find(call => call[0] === 'state');
            const playerData = stateCall[1].players['player1'];

            expect(playerData).toHaveProperty('x', 100);
            expect(playerData).toHaveProperty('y', 100);
            expect(playerData).toHaveProperty('health', 2);
            expect(playerData).toHaveProperty('armor', 1);
            expect(playerData).toHaveProperty('hasFlag', false);
            expect(playerData).toHaveProperty('team', 'red');
            expect(playerData).toHaveProperty('speedBoostActive', false);
            expect(playerData).toHaveProperty('username', 'TestPlayer');

            clearInterval(interval);
        });
    });
}); 