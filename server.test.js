import io from 'socket.io-client';
import { server, io as serverIo, projectileUpdateInterval } from './server.js'; // Pfad anpassen
//LOOOOOOS gehts npm test server.test.js
const PORT = 3000;
const SOCKET_URL = `http://localhost:${PORT}`;

describe('Server Tests', () => {
  let clientSocket1;
  let clientSocket2;

  beforeAll((done) => {
    if (!server.listening) {
      server.listen(PORT, () => {
        console.log(`Test-Server läuft auf Port ${PORT}`);
        done();
      });
    } else {
      done();
    }
  });

  afterAll((done) => {
    clearInterval(projectileUpdateInterval); // Beendet das `setInterval`
    serverIo.close(); // Schließt Socket.io sauber
    server.close(() => {
      console.log('Test-Server geschlossen');
      done();
    });
  });

  beforeEach((done) => {
    clientSocket1 = io.connect(SOCKET_URL, { forceNew: true });
    clientSocket2 = io.connect(SOCKET_URL, { forceNew: true });

    let connections = 0;

    function checkDone() {
      connections++;
      if (connections === 2) done();
    }

    clientSocket1.on('connect', checkDone);
    clientSocket2.on('connect', checkDone);
  });

  afterEach((done) => {
    clientSocket1.disconnect();
    clientSocket2.disconnect();
    done();
  });

  test('Server akzeptiert Verbindungen', async () => {
    expect(clientSocket1.connected).toBe(true);
  });

  test('Spieler kann Team beitreten', (done) => {
    const mockPlayer = { username: 'TestUser', team: 'red' };

    console.log("Sende 'chooseTeam' Event...");
    clientSocket1.emit('chooseTeam', mockPlayer);

    setTimeout(() => { // Wartezeit, damit der Server antworten kann
        clientSocket1.once('state', (state) => {
            console.log("📥 ERHALTENES 'state'-EVENT:", state);

            expect(state).toBeDefined();
            expect(state.players).toBeDefined();
            expect(state.players[clientSocket1.id]).toBeDefined(); 

            expect(state.players[clientSocket1.id]).toMatchObject({
                username: mockPlayer.username,
                team: mockPlayer.team
            });

            done();
        });
    }, 500); //  500ms warten
}, 10000); // Timeout auf 10 Sekunden erhöhen




test('Bewegung wird aktualisiert', (done) => {
  const mockPlayer = { username: 'TestUser', team: 'red' };

  console.log("📡 Sende 'chooseTeam' Event...");
  clientSocket1.emit('chooseTeam', mockPlayer);

  const waitForPlayerInState = (attemptsLeft = 5) => {
      clientSocket1.emit('requestState'); // Falls der Server das unterstützt

      clientSocket1.once('state', (state) => {
          console.log(`🔍 Versuch ${6 - attemptsLeft}: Spieler im State?`, state.players[clientSocket1.id]);

          if (state.players && state.players[clientSocket1.id]) {
              console.log(`✅ Spieler gefunden nach ${6 - attemptsLeft} Versuchen.`);
              runMoveTest(state);
          } else if (attemptsLeft > 0) {
              setTimeout(() => waitForPlayerInState(attemptsLeft - 1), 200);
          } else {
              return done(new Error("❌ Spieler nicht im State nach mehreren Versuchen!"));
          }
      });
  };

  const runMoveTest = (stateBeforeMove) => {
      const previousX = stateBeforeMove.players[clientSocket1.id].x || 0;
      console.log(`🔍 Vorheriger X-Wert: ${previousX}`);

      clientSocket1.emit('move', { dx: 10, dy: 0 });

      setTimeout(() => {
          clientSocket1.once('state', (stateAfterMove) => {
              console.log("📥 ERHALTENES 'state'-EVENT (nach Bewegung):", stateAfterMove);

              expect(stateAfterMove).toBeDefined();
              expect(stateAfterMove.players).toBeDefined();
              expect(stateAfterMove.players[clientSocket1.id]).toBeDefined();

              const newX = stateAfterMove.players[clientSocket1.id].x;
              console.log(`📊 Nachheriger X-Wert: ${newX}, Erwartet: ${previousX + 10}`);

              expect(newX).toBe(previousX + 10);

              done();
          });
      }, 1000);
  };

  waitForPlayerInState(); // Starte die wiederholte Überprüfung
}, 20000); // Timeout auf 20 Sekunden setzen




test('Flagge kann aufgenommen werden', (done) => {
  const mockPlayer = { username: 'FlagHunter', team: 'red' };

  console.log("📡 Sende 'chooseTeam' Event...");
  clientSocket1.emit('chooseTeam', mockPlayer);

  clientSocket1.once('state', (state) => {
      console.log("📥 ERHALTENES 'state'-EVENT (nach Teamwahl):", state);

      clientSocket1.emit('move', { dx: 650, dy: 0 });
      console.log("📡 'move' Event gesendet");

      setTimeout(() => { // 👈 500ms warten, um sicherzustellen, dass die Bewegung verarbeitet wurde
          clientSocket1.once('state', (state) => {
              console.log("📥 ERHALTENES 'state'-EVENT (nach Bewegung):", state);

              expect(state).toBeDefined();
              expect(state.flag.holder).toBe(clientSocket1.id);
              expect(state.players[clientSocket1.id].hasFlag).toBe(true);

              done();
          });
      }, 500); // 👈 Timeout für Verzögerungen
  });
}, 10000); // 👈 Timeout auf 10 Sekunden erhöhen



  test('Spieler wird bei Disconnect entfernt', (done) => {
    clientSocket1.emit('chooseTeam', { username: 'Leaver', team: 'blue' });

    clientSocket1.once('state', () => {
      clientSocket1.disconnect();

      clientSocket2.once('state', (newState) => {
        expect(newState.players[clientSocket1.id]).toBeUndefined();
        done();
      });
    });
  });
});
