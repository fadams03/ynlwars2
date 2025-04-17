export const PORT = 8200;

// Klassendefinitionen
export const classes = {
    classic: {
        name: 'Klassisch',
        damage: 1,
        cooldown: 100,
        speed: 2.5,
        projectileCount: 1,
        spread: 0,
        projectileSpeed: 20,
        maxDistance: 600,  // Mittlere Reichweite
        minDamage: 1      // Konstanter Schaden
    },
    sniper: {
        name: 'Scharfschütze',
        damage: 2,
        cooldown: 800,
        speed: 2,
        projectileCount: 1,
        spread: 0,
        projectileSpeed: 20,
        maxDistance: 1000,  // Hohe Reichweite
        minDamage: 2      // Konstanter Schaden
    },
    shotgun: {
        name: 'Shotgun',
        damage: 3,
        cooldown: 1000,
        speed: 1.7,
        projectileCount: 2,
        spread: 0.2,
        projectileSpeed: 20,
        maxDistance: 300,  // Kurze Reichweite
        minDamage: 1    // Abnehmender Schaden
    }
};

export const walls = [
    { x: 300, y: 200, width: 10, height: 400 },
    { x: 1200 -10, y: 200, width: 10, height: 400 },
    { x: 700, y: 350, width: 10, height: 100 },
    { x: 800 -10, y: 350, width: 10, height: 100 },
    { x: 700, y: 200, width: 100, height: 10 },
    { x: 700, y: 600 -10 , width: 100, height: 10 }
];

export const redSpawn = { x: 100, y: 400, width: 200, height: 200 };
export const blueSpawn = { x: 1400, y: 400, width: 200, height: 200 };
export const border = { x: 0, y: 0, width: 1600, height: 1200 };

export const MEDIKIT_RESPAWN_TIME = 45000;
export const ARMOR_RESPAWN_TIME = 45000; 