// LOOOOOS gehts: node server.js run
// npx cypress run game.cy.js
describe('E2E Test für Multiplayer-Spiel', () => {
    beforeEach(() => {
        cy.visit('http://localhost:3000/'); // Deine Spiel-URL
    });

    it('Wählt ein Team und startet das Spiel', () => {
        cy.get('#username').type('Testspieler');

        // Rotes Team wählen
        cy.get('#teamSelection button img[alt="red"]').click();
        cy.get('#gameCanvas', { timeout: 5000 }).should('be.visible');

        // Seite neu laden und erneut ein Team wählen
        cy.reload();
        cy.get('#username').should('be.visible').type('Testspieler');
        cy.get('#teamSelection button img[alt="blue"]').click();
        cy.get('#gameCanvas', { timeout: 5000 }).should('be.visible');
    });

    it('Bewegt den Spieler mit WASD', () => {
        cy.get('body').trigger('keydown', { key: 'w', force: true });
        cy.wait(500);
        cy.get('body').trigger('keyup', { key: 'w', force: true });

        cy.get('body').trigger('keydown', { key: 'a', force: true });
        cy.wait(500);
        cy.get('body').trigger('keyup', { key: 'a', force: true });

        cy.get('body').trigger('keydown', { key: 's', force: true });
        cy.wait(500);
        cy.get('body').trigger('keyup', { key: 's', force: true });

        cy.get('body').trigger('keydown', { key: 'd', force: true });
        cy.wait(500);
        cy.get('body').trigger('keyup', { key: 'd', force: true });
    });

    it('Schießt ein Projektil mit der Leertaste', () => {
        cy.get('body').trigger('keydown', { key: ' ', force: true });
        cy.wait(500);
        cy.get('body').trigger('keyup', { key: ' ', force: true });
    });

    it('Sendet eine Chat-Nachricht', () => {
        cy.get('#username').type('Testspieler');
        cy.get('#teamSelection button img[alt="red"]').click();
        cy.get('#gameCanvas').should('be.visible');

        cy.wait(1000);
        
        // Spy auf socket.emit setzen
        cy.window().then((win) => {
            cy.spy(win.socket, 'emit').as('socketEmit');
        });

        // Nachricht eingeben und absenden
        cy.get('#chatInput').type('Hallo Welt');
        cy.get('#chatForm button[type="submit"]').click();

        // Prüfen, ob `socket.emit` die Nachricht gesendet hat
        cy.get('@socketEmit').should('be.calledWith', 'chatMessage', 'Hallo Welt');

        // Warte auf Server-Antwort und prüfe den Chat
        cy.wait(500);
        cy.get('#chatMessages li').last().should('include.text', 'Hallo Welt');
    });

    it('Bewegt die Maus und schießt', () => {
        cy.get('#gameCanvas').trigger('mousemove', { clientX: 300, clientY: 300, force: true });
        cy.get('body').click({ force: true });
    });

    it('Empfängt Spielstatus-Updates', () => {
        cy.window().then((win) => {
            win.socket.emit('state', {
                players: {
                    'test-id': { x: 200, y: 200, team: 'red', username: 'Testspieler' }
                },
                projectiles: [],
                walls: [],
                flag: {},
                score: { red: 0, blue: 0 },
                redSpawn: { x: 100, y: 100 },
                blueSpawn: { x: 500, y: 500 }
            });
        });
    });
})
// TBC: Spieler tötet anderen Spieler, Spieler nimmt Flagge ein

