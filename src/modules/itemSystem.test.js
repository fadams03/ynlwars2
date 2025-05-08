import { jest } from '@jest/globals';
import { setupItemSystem } from './itemSystem';
import { medikits, armors } from './gameState';
import { MEDIKIT_RESPAWN_TIME, ARMOR_RESPAWN_TIME } from './gameConfig';

describe('Item System', () => {
    let mockIo;

    beforeEach(() => {
        // Reset der Mocks und des Zustands
        jest.useFakeTimers();
        mockIo = {
            emit: jest.fn()
        };
        medikits.forEach(m => m.active = false);
        armors.forEach(a => a.active = false);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('sollte Medikits nach der Respawn-Zeit wieder aktivieren', () => {
        setupItemSystem(mockIo);
        
        // Simuliere die Respawn-Zeit
        jest.advanceTimersByTime(MEDIKIT_RESPAWN_TIME);

        // Überprüfe, ob alle Medikits aktiv sind
        medikits.forEach(medikit => {
            expect(medikit.active).toBe(true);
        });

        // Überprüfe, ob das Update-Event gesendet wurde
        expect(mockIo.emit).toHaveBeenCalledWith('updateMedikits', medikits);
    });

    it('sollte Rüstungen nach der Respawn-Zeit wieder aktivieren', () => {
        setupItemSystem(mockIo);
        
        // Simuliere die Respawn-Zeit
        jest.advanceTimersByTime(ARMOR_RESPAWN_TIME);

        // Überprüfe, ob alle Rüstungen aktiv sind
        armors.forEach(armor => {
            expect(armor.active).toBe(true);
        });

        // Überprüfe, ob das Update-Event gesendet wurde
        expect(mockIo.emit).toHaveBeenCalledWith('updateArmors', armors);
    });

    it('sollte beide Timer korrekt einrichten', () => {
        setupItemSystem(mockIo);
        
        // Simuliere beide Respawn-Zeiten
        jest.advanceTimersByTime(MEDIKIT_RESPAWN_TIME);
        jest.advanceTimersByTime(ARMOR_RESPAWN_TIME);

        // Überprüfe, ob beide Update-Events gesendet wurden
        expect(mockIo.emit).toHaveBeenCalledWith('updateMedikits', medikits);
        expect(mockIo.emit).toHaveBeenCalledWith('updateArmors', armors);
    });

    it('sollte die Timer wiederholt ausführen', () => {
        setupItemSystem(mockIo);
        
        // Simuliere mehrere Respawn-Zeiten
        jest.advanceTimersByTime(MEDIKIT_RESPAWN_TIME * 2);
        jest.advanceTimersByTime(ARMOR_RESPAWN_TIME * 2);

        // Überprüfe, ob die Events mehrmals gesendet wurden
        const medikitCalls = mockIo.emit.mock.calls.filter(call => call[0] === 'updateMedikits');
        const armorCalls = mockIo.emit.mock.calls.filter(call => call[0] === 'updateArmors');

        expect(medikitCalls.length).toBeGreaterThan(1);
        expect(armorCalls.length).toBeGreaterThan(1);
    });
}); 