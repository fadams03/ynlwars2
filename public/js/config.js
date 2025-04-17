// Spielkonfiguration
export const CANVAS_CONFIG = {
    width: 1600,
    height: 1200
};

// Klassendefinitionen
export const CLASSES = {
    classic: {
        name: 'Klassisch',
        damage: 1,
        cooldown: 500,
        speed: 3,
        projectileCount: 1,
        spread: 0,
        description: 'Standard-Klasse mit normalem Schaden und Cooldown'
    },
    sniper: {
        name: 'Scharfschütze',
        damage: 2,
        cooldown: 1000,
        speed: 2,
        projectileCount: 1,
        spread: 0,
        description: 'Hoher Schaden (2 Herzen) aber langer Cooldown. Langsamere Bewegung.'
    },
    shotgun: {
        name: 'Shotgun',
        damage: 3,
        cooldown: 800,
        speed: 1.5,
        projectileCount: 2,
        spread: 0.2,
        description: 'Zwei Projektile auf kurze Distanz, hoher Schaden. Sehr langsame Bewegung.'
    }
};

// Bewegungsdefinitionen
export const MOVEMENTS = {
    w: { dx: 0, dy: -3 },
    a: { dx: -3, dy: 0 },
    s: { dx: 0, dy: 3 },
    d: { dx: 3, dy: 0 }
};

// Spielkonstanten
export const GAME_CONSTANTS = {
    SPEED_BOOST_DURATION: 20000,
    PLAYER_SIZE: 20,
    ITEM_PICKUP_DISTANCE: 30
}; 