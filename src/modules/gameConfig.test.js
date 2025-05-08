import { classes, walls, redSpawn, blueSpawn, border, MEDIKIT_RESPAWN_TIME, ARMOR_RESPAWN_TIME } from './gameConfig';

describe('Game Config', () => {
    describe('classes', () => {
        it('sollte alle Spielerklassen definiert haben', () => {
            expect(classes).toHaveProperty('classic');
            expect(classes).toHaveProperty('sniper');
            expect(classes).toHaveProperty('shotgun');
        });

        it('sollte korrekte Eigenschaften für jede Klasse haben', () => {
            const requiredProperties = [
                'name',
                'damage',
                'cooldown',
                'speed',
                'projectileCount',
                'spread',
                'projectileSpeed',
                'maxDistance',
                'minDamage'
            ];

            Object.values(classes).forEach(playerClass => {
                requiredProperties.forEach(prop => {
                    expect(playerClass).toHaveProperty(prop);
                });
            });
        });

        it('sollte gültige Werte für jede Klasse haben', () => {
            Object.entries(classes).forEach(([className, playerClass]) => {
                expect(playerClass.damage).toBeGreaterThan(0);
                expect(playerClass.cooldown).toBeGreaterThan(0);
                expect(playerClass.speed).toBeGreaterThan(0);
                expect(playerClass.projectileCount).toBeGreaterThan(0);
                expect(playerClass.projectileSpeed).toBeGreaterThan(0);
                expect(playerClass.maxDistance).toBeGreaterThan(0);
                expect(playerClass.minDamage).toBeGreaterThan(0);
            });
        });
    });

    describe('walls', () => {
        it('sollte alle Wände definiert haben', () => {
            expect(walls).toBeInstanceOf(Array);
            expect(walls.length).toBeGreaterThan(0);
        });

        it('sollte gültige Eigenschaften für jede Wand haben', () => {
            walls.forEach(wall => {
                expect(wall).toHaveProperty('x');
                expect(wall).toHaveProperty('y');
                expect(wall).toHaveProperty('width');
                expect(wall).toHaveProperty('height');
                expect(wall.width).toBeGreaterThan(0);
                expect(wall.height).toBeGreaterThan(0);
            });
        });
    });

    describe('spawn points', () => {
        it('sollte gültige Spawn-Punkte definiert haben', () => {
            expect(redSpawn).toBeDefined();
            expect(blueSpawn).toBeDefined();
            
            [redSpawn, blueSpawn].forEach(spawn => {
                expect(spawn).toHaveProperty('x');
                expect(spawn).toHaveProperty('y');
                expect(spawn).toHaveProperty('width');
                expect(spawn).toHaveProperty('height');
                expect(spawn.width).toBeGreaterThan(0);
                expect(spawn.height).toBeGreaterThan(0);
            });
        });
    });

    describe('border', () => {
        it('sollte gültige Grenzen definiert haben', () => {
            expect(border).toBeDefined();
            expect(border).toHaveProperty('x');
            expect(border).toHaveProperty('y');
            expect(border).toHaveProperty('width');
            expect(border).toHaveProperty('height');
            expect(border.width).toBeGreaterThan(0);
            expect(border.height).toBeGreaterThan(0);
        });
    });

    describe('respawn times', () => {
        it('sollte gültige Respawn-Zeiten definiert haben', () => {
            expect(MEDIKIT_RESPAWN_TIME).toBeGreaterThan(0);
            expect(ARMOR_RESPAWN_TIME).toBeGreaterThan(0);
        });
    });
}); 