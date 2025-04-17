import { server, io, checkCollision, checkBorderCollision, players, flag, score } from './server.js';
//LOOOOOOS gehts npm test serverunit.test.js
// ========================
// 🔹 Utility Funktions Tests
// ========================
describe('Utility Funktions - Unit Tests', () => {

    test('checkCollision erkennt eine Kollision', () => {
        const walls = [{ x: 100, y: 100, width: 50, height: 50 }];
        expect(checkCollision(110, 110, 20, 20, walls)).toBe(true);
    });

    test('checkCollision erkennt keine Kollision', () => {
        const walls = [{ x: 200, y: 200, width: 50, height: 50 }];
        expect(checkCollision(100, 100, 20, 20, walls)).toBe(false);
    });

    test('checkBorderCollision innerhalb der Grenzen', () => {
        expect(checkBorderCollision(100, 100, 20, 20)).toBe(true);
    });

    test('checkBorderCollision außerhalb der Grenzen (links)', () => {
        expect(checkBorderCollision(-10, 100, 20, 20)).toBe(false);
    });

});

// ========================
// 🔹 Spiellogik Tests (Unit-Tests ohne Server)
// ========================
describe('Spiellogik - Unit Tests', () => {

    beforeEach(() => {
        for (const key in players) delete players[key]; // Setzt Spieler zurück
        flag.holder = null;
        score.red = 0;
        score.blue = 0;
    });

    test('Spieler kann zur Spielerliste hinzugefügt werden', () => {
        const playerId = 'player1';
        players[playerId] = { username: 'TestUser', team: 'red', x: 100, y: 400, hasFlag: false };

        expect(players[playerId]).toBeDefined();
        expect(players[playerId].username).toBe('TestUser');
        expect(players[playerId].team).toBe('red');
    });

    test('Spieler kann sich bewegen', () => {
        const playerId = 'player1';
        players[playerId] = { x: 100, y: 100, team: 'red', username: 'TestUser', hasFlag: false };

        const dx = 10;
        const dy = 10;

        players[playerId].x += dx;
        players[playerId].y += dy;

        expect(players[playerId].x).toBe(110);
        expect(players[playerId].y).toBe(110);
    });

    test('Spieler kann Flagge aufnehmen', () => {
        const playerId = 'player1';
        players[playerId] = { x: 750, y: 400, team: 'red', username: 'TestUser', hasFlag: false };

        if (!flag.holder && Math.abs(players[playerId].x - flag.x) < 15 && Math.abs(players[playerId].y - flag.y) < 15) {
            flag.holder = playerId;
            players[playerId].hasFlag = true;
        }

        expect(flag.holder).toBe(playerId);
        expect(players[playerId].hasFlag).toBe(true);
    });

    test('Spieler kann Flagge ins Ziel bringen und Punktestand erhöhen', () => {
        const playerId = 'player1';
        players[playerId] = { x: 100, y: 400, team: 'red', username: 'TestUser', hasFlag: true };

        if (players[playerId].hasFlag) {
            score.red++;
            flag.x = 750;
            flag.y = 400;
            flag.holder = null;
            players[playerId].hasFlag = false;
        }

        expect(score.red).toBe(1);
        expect(flag.holder).toBe(null);
        expect(players[playerId].hasFlag).toBe(false);
    });

});
afterAll((done) => {
    io.close(() => {
        console.log('🛑 WebSocket-Server geschlossen.');
        server.close(() => {
            console.log('🚀 HTTP-Server nach Tests geschlossen.');
            done();
        });
    });
});
