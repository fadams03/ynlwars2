import { checkCollision, checkBorderCollision } from './collisionUtils';
import { walls, border } from './gameConfig';

describe('Collision Utils', () => {
    describe('checkCollision', () => {
        it('sollte Kollision mit Wand erkennen', () => {
            const wall = walls[0];
            const result = checkCollision(
                wall.x,
                wall.y,
                wall.width,
                wall.height,
                walls
            );
            expect(result).toBe(true);
        });

        it('sollte keine Kollision außerhalb der Wände erkennen', () => {
            const result = checkCollision(
                0,
                0,
                10,
                10,
                walls
            );
            expect(result).toBe(false);
        });

        it('sollte Kollision bei teilweiser Überlappung erkennen', () => {
            const wall = walls[0];
            const result = checkCollision(
                wall.x - 5,
                wall.y - 5,
                10,
                10,
                walls
            );
            expect(result).toBe(true);
        });
    });

    describe('checkBorderCollision', () => {
        it('sollte Position innerhalb der Grenzen als gültig erkennen', () => {
            const result = checkBorderCollision(
                border.x + 10,
                border.y + 10,
                10,
                10
            );
            expect(result).toBe(true);
        });

        it('sollte Position außerhalb der Grenzen als ungültig erkennen', () => {
            const result = checkBorderCollision(
                border.x - 10,
                border.y - 10,
                10,
                10
            );
            expect(result).toBe(false);
        });

        it('sollte Position am Rand als gültig erkennen', () => {
            const result = checkBorderCollision(
                border.x,
                border.y,
                10,
                10
            );
            expect(result).toBe(true);
        });

        it('sollte Position am äußeren Rand als gültig erkennen', () => {
            const result = checkBorderCollision(
                border.x + border.width - 10,
                border.y + border.height - 10,
                10,
                10
            );
            expect(result).toBe(true);
        });
    });
}); 