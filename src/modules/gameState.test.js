import { players, projectiles, chatMessages, score, flag, medikits, armors } from './gameState';

describe('Game State', () => {
    beforeEach(() => {
        // Reset des Spielzustands vor jedem Test
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
    });

    describe('players', () => {
        it('sollte ein leeres Objekt sein', () => {
            expect(players).toBeInstanceOf(Object);
            expect(Object.keys(players)).toHaveLength(0);
        });
    });

    describe('projectiles', () => {
        it('sollte ein leeres Array sein', () => {
            expect(projectiles).toBeInstanceOf(Array);
            expect(projectiles).toHaveLength(0);
        });
    });

    describe('chatMessages', () => {
        it('sollte ein leeres Array sein', () => {
            expect(chatMessages).toBeInstanceOf(Array);
            expect(chatMessages).toHaveLength(0);
        });
    });

    describe('score', () => {
        it('sollte initial 0 für beide Teams haben', () => {
            expect(score).toHaveProperty('red', 0);
            expect(score).toHaveProperty('blue', 0);
        });
    });

    describe('flag', () => {
        it('sollte die korrekte Startposition haben', () => {
            expect(flag).toHaveProperty('x', 750);
            expect(flag).toHaveProperty('y', 400);
            expect(flag).toHaveProperty('holder', null);
        });
    });

    describe('medikits', () => {
        it('sollte zwei Medikits haben', () => {
            expect(medikits).toHaveLength(2);
        });

        it('sollte gültige Positionen für Medikits haben', () => {
            medikits.forEach(medikit => {
                expect(medikit).toHaveProperty('x');
                expect(medikit).toHaveProperty('y');
                expect(medikit).toHaveProperty('active', true);
            });
        });
    });

    describe('armors', () => {
        it('sollte zwei Rüstungen haben', () => {
            expect(armors).toHaveLength(2);
        });

        it('sollte gültige Positionen für Rüstungen haben', () => {
            armors.forEach(armor => {
                expect(armor).toHaveProperty('x');
                expect(armor).toHaveProperty('y');
                expect(armor).toHaveProperty('active', true);
            });
        });
    });
}); 