import { medikits, armors } from './gameState.js';
import { MEDIKIT_RESPAWN_TIME, ARMOR_RESPAWN_TIME } from './gameConfig.js';

export function setupItemSystem(io) {
    // Medikit-Respawn
    setInterval(() => {
        medikits.forEach(medikit => medikit.active = true);
        io.emit('updateMedikits', medikits);
    }, MEDIKIT_RESPAWN_TIME);

    // Rüstungs-Respawn
    setInterval(() => {
        armors.forEach(armor => armor.active = true);
        io.emit('updateArmors', armors);
    }, ARMOR_RESPAWN_TIME);
} 