import {CLASSES} from "./js/config.js"

// Private Initialisierung
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const teamSelection = document.getElementById('teamSelection');

// Basis-Auflösung des Spiels
const BASE_WIDTH = 1600;
const BASE_HEIGHT = 1200;

// Skaliere Canvas sowohl visuell als auch in der Auflösung
function scaleCanvas() {
    const ratio = BASE_WIDTH / BASE_HEIGHT;
    const windowRatio = window.innerWidth / window.innerHeight;

    let newWidth, newHeight;
    
    if (windowRatio > ratio) {
        // Fenster ist breiter → passe Höhe an
        newHeight = window.innerHeight;
        newWidth = newHeight * ratio;
    } else {
        // Fenster ist höher → passe Breite an
        newWidth = window.innerWidth;
        newHeight = newWidth / ratio;
    }

    // Setze die tatsächliche Canvas-Auflösung
    canvas.width = BASE_WIDTH;
    canvas.height = BASE_HEIGHT;

    // Setze die visuelle Größe
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;
}

// Initialisiere Canvas beim Start
scaleCanvas();
window.addEventListener("resize", scaleCanvas);

// Optimierte Terrain-Texturen mit Cache
const terrainPatterns = {
    grass: null,
    dirt: null,
    concrete: null,
    cachedDecorations: []
};

// Erstelle Terrain-Texturen
function createTerrainPatterns() {
    // Gras-Textur
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 40;
    grassCanvas.height = 40;
    const grassCtx = grassCanvas.getContext('2d');
    grassCtx.fillStyle = '#2d5a27';
    grassCtx.fillRect(0, 0, 40, 40);
    
    // Vorberechnete Grasvariationen
    const grassVariations = [
        { color: '#1e4020', size: 3 },
        { color: '#3a7a33', size: 2 }
    ];
    
    // Feste Positionen für Grasdetails
    for (let i = 0; i < 20; i++) {
        const variation = grassVariations[i % 2];
        const x = (i * 4) % 40;
        const y = Math.floor(i / 10) * 4;
        grassCtx.fillStyle = variation.color;
        grassCtx.fillRect(x, y, variation.size, variation.size);
    }
    terrainPatterns.grass = ctx.createPattern(grassCanvas, 'repeat');

    // Schmutz-Textur
    const dirtCanvas = document.createElement('canvas');
    dirtCanvas.width = 20;
    dirtCanvas.height = 20;
    const dirtCtx = dirtCanvas.getContext('2d');
    dirtCtx.fillStyle = '#8B4513';
    dirtCtx.fillRect(0, 0, 20, 20);
    for (let i = 0; i < 8; i++) {
        dirtCtx.fillStyle = Math.random() > 0.5 ? '#654321' : '#8B6914';
        dirtCtx.fillRect(Math.random() * 20, Math.random() * 20, 3, 3);
    }
    terrainPatterns.dirt = ctx.createPattern(dirtCanvas, 'repeat');

    // Beton-Textur
    const concreteCanvas = document.createElement('canvas');
    concreteCanvas.width = 20;
    concreteCanvas.height = 20;
    const concreteCtx = concreteCanvas.getContext('2d');
    concreteCtx.fillStyle = '#808080';
    concreteCtx.fillRect(0, 0, 20, 20);
    for (let i = 0; i < 10; i++) {
        concreteCtx.fillStyle = Math.random() > 0.5 ? '#707070' : '#909090';
        concreteCtx.fillRect(Math.random() * 20, Math.random() * 20, 2, 2);
    }
    terrainPatterns.concrete = ctx.createPattern(concreteCanvas, 'repeat');
}

// Erstelle die Texturen beim Start
createTerrainPatterns();


// Spielzustand
const gameState = {
    players: {},
    projectiles: [],
    walls: [],
    flag: {},
    score: { red: 0, blue: 0 },
    redSpawn: {},
    blueSpawn: {},
    medikits: [],
    armors: [],
    speedBoosters: [],
    mouseX: 0,
    mouseY: 0,
    playerX: 0,
    playerY: 0,
    canShoot: true,
    keys: {},
    selectedClass: 'classic',
    // Neue statische Dekorationen
    staticDecorations: {
        tireTrackPositions: [],
        craterPositions: []
    }
};

// Bewegungs-Definitionen
const movements = {
    w: { dx: 0, dy: -3 },
    a: { dx: -3, dy: 0 },
    s: { dx: 0, dy: 3 },
    d: { dx: 3, dy: 0 },
    W: { dx: 0, dy: -3 },
    A: { dx: -3, dy: 0 },
    S: { dx: 0, dy: 3 },
    D: { dx: 3, dy: 0 }
};

// Render-Funktionen
const render = {
    clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    // Rechteck-Funktion mit optionaler Textur und Schatten
    rect(x, y, w, h, color, pattern = null, withShadow = false) {
        ctx.save();
        if (withShadow) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
        }
        if (pattern) {
            ctx.fillStyle = pattern;
        } else {
        ctx.fillStyle = color;
        }
        ctx.fillRect(x, y, w, h);
        ctx.restore();
    },

    // Funktion für Krater und Beschädigungen
    drawCrater(x, y, size) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();
        ctx.restore();
    },

    // Funktion für Sandsäcke
    drawSandbag(x, y, width, height) {
        ctx.save();
        ctx.fillStyle = '#8B7355';
        ctx.strokeStyle = '#5C4033';
        ctx.lineWidth = 2;

        // Hauptform
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 5);
        ctx.fill();
        ctx.stroke();

        // Details
        ctx.fillStyle = '#7A6447';
        ctx.beginPath();
        ctx.roundRect(x + width * 0.1, y + height * 0.2, width * 0.8, height * 0.3, 3);
        ctx.fill();

        ctx.restore();
    },

    // Funktion für Stacheldraht
    drawBarbed(x, y, width) {
        ctx.save();
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 2;

        // Hauptdraht
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + width, y);
        ctx.stroke();

        // Stacheln
        for (let i = 0; i < width; i += 10) {
            ctx.beginPath();
            ctx.moveTo(x + i, y - 5);
            ctx.lineTo(x + i + 5, y);
            ctx.lineTo(x + i, y + 5);
            ctx.stroke();
        }

        ctx.restore();
    },

    // Funktion für die Basis
    drawBase(x, y, size, team) {
        ctx.save();
        
        // Hauptplattform
        this.rect(x - size/2, y - size/2, size, size, 
            team === 'red' ? 'rgba(255,0,0,0.1)' : 'rgba(0,0,255,0.1)', 
            terrainPatterns.concrete, true);

        // Basis-Markierungen
        ctx.strokeStyle = team === 'red' ? '#FF0000' : '#0000FF';
        ctx.lineWidth = 4;
        ctx.setLineDash([15, 5]);
        ctx.strokeRect(x - size/2 + 10, y - size/2 + 10, size - 20, size - 20);

        // Basis-Symbol
        const symbol = team === 'red' ? '🔴' : '🔵';
        ctx.font = '30px Arial';
        ctx.fillStyle = team === 'red' ? '#FF0000' : '#0000FF';
        ctx.textAlign = 'center';
        ctx.fillText(symbol, x, y);

        // Sandsäcke um die Basis
        for (let i = 0; i < 4; i++) {
            this.drawSandbag(x - size/2 + (i * 30), y + size/2 - 15, 25, 15);
            this.drawSandbag(x - size/2 + (i * 30), y - size/2, 25, 15);
        }

        ctx.restore();
    },

    // Funktion für Dekoration
    drawDecoration(x, y, type) {
        ctx.save();
        switch(type) {
            case 'crater':
                this.drawCrater(x, y, 15 + Math.random() * 10);
                break;
            case 'sandbag':
                this.drawSandbag(x, y, 25, 15);
                break;
            case 'barbed':
                this.drawBarbed(x, y, 50);
                break;
        }
        ctx.restore();
    },

    circle(x, y, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    },

    text(text, x, y, size = '14px') {
        ctx.fillStyle = 'black';
        ctx.font = `${size} Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(text, x, y);
    },

    // Render-Funktionen mit direkter Canvas-Zeichnung
    drawWarrior(x, y, team, hasFlag) {
        ctx.save();
        ctx.translate(x, y);
        
        // Bestimme die Bewegungsrichtung
let direction = 'right'; // Standardansicht
if (gameState.keys.w || gameState.keys.W) direction = 'up';
if (gameState.keys.s || gameState.keys.S) direction = 'down';
if (gameState.keys.a || gameState.keys.A) direction = 'left';
if (gameState.keys.d || gameState.keys.D) direction = 'right';
        
        // Pixelgröße
        const pixelSize = 3;
        
        // Farbpalette für militärischen Look
        const colors = {
            outline: '#000000',
            hair: '#3A2819',
            skin: '#E6B89C',
            uniform: team === 'red' ? '#8B0000' : '#000080',
            uniformLight: team === 'red' ? '#A52A2A' : '#0000CD',
            pants: '#2F4F4F',
            pantsLight: '#556B6B',
            boots: '#2F2F2F',
            bootsLight: '#3D3D3D'
        };
        
        // Zeichne den Charakter pixelweise
        const drawPixel = (x, y, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        };
        
        // Grundposition für den Charakter
        const offsetX = -6;
        const offsetY = -12;
        
        switch(direction) {
            case 'right':
                // Haare (mit Helm-Form)
                for(let x = 1; x < 11; x++) {
                    for(let y = 0; y < 4; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.hair);
                    }
                }
                drawPixel(offsetX + 0, offsetY + 1, colors.hair);
                drawPixel(offsetX + 11, offsetY + 1, colors.hair);
                drawPixel(offsetX + 0, offsetY + 2, colors.hair);
                drawPixel(offsetX + 11, offsetY + 2, colors.hair);

                // Gesicht
                for(let x = 2; x < 10; x++) {
                    for(let y = 3; y < 6; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.skin);
                    }
                }

                // Augen
                drawPixel(offsetX + 8, offsetY + 4, colors.outline);

                // Uniform Oberteil
                for(let x = 2; x < 10; x++) {
                    for(let y = 6; y < 9; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.uniform : colors.uniformLight);
                    }
                }

                // Schulterpolster
                drawPixel(offsetX + 1, offsetY + 6, colors.uniform);
                drawPixel(offsetX + 10, offsetY + 6, colors.uniform);

                // Hose
                for(let x = 3; x < 9; x++) {
                    for(let y = 9; y < 11; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.pants : colors.pantsLight);
                    }
                }

                // Stiefel
                for(let x = 2; x < 5; x++) {
                    drawPixel(offsetX + x, offsetY + 11, colors.boots);
                }
                for(let x = 7; x < 10; x++) {
                    drawPixel(offsetX + x, offsetY + 11, colors.boots);
                }
                drawPixel(offsetX + 2, offsetY + 10, colors.bootsLight);
                drawPixel(offsetX + 8, offsetY + 10, colors.bootsLight);

                break;

            case 'left':
                // Haare (mit Helm-Form)
                for(let x = 1; x < 11; x++) {
                    for(let y = 0; y < 4; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.hair);
                    }
                }
                drawPixel(offsetX + 0, offsetY + 1, colors.hair);
                drawPixel(offsetX + 11, offsetY + 1, colors.hair);
                drawPixel(offsetX + 0, offsetY + 2, colors.hair);
                drawPixel(offsetX + 11, offsetY + 2, colors.hair);

                // Gesicht
                for(let x = 2; x < 10; x++) {
                    for(let y = 3; y < 6; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.skin);
                    }
                }

                // Augen
                drawPixel(offsetX + 3, offsetY + 4, colors.outline);

                // Uniform Oberteil
                for(let x = 2; x < 10; x++) {
                    for(let y = 6; y < 9; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.uniform : colors.uniformLight);
                    }
                }

                // Schulterpolster
                drawPixel(offsetX + 1, offsetY + 6, colors.uniform);
                drawPixel(offsetX + 10, offsetY + 6, colors.uniform);

                // Hose
                for(let x = 3; x < 9; x++) {
                    for(let y = 9; y < 11; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.pants : colors.pantsLight);
                    }
                }

                // Stiefel
                for(let x = 2; x < 5; x++) {
                    drawPixel(offsetX + x, offsetY + 11, colors.boots);
                }
                for(let x = 7; x < 10; x++) {
                    drawPixel(offsetX + x, offsetY + 11, colors.boots);
                }
                drawPixel(offsetX + 2, offsetY + 10, colors.bootsLight);
                drawPixel(offsetX + 8, offsetY + 10, colors.bootsLight);

                break;

            case 'up':
                // Haare (mit Helm-Form)
                for(let x = 1; x < 7; x++) {
                    for(let y = 0; y < 4; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.hair);
                    }
                }
                drawPixel(offsetX + 0, offsetY + 1, colors.hair);
                drawPixel(offsetX + 7, offsetY + 1, colors.hair);
                drawPixel(offsetX + 0, offsetY + 2, colors.hair);
                drawPixel(offsetX + 7, offsetY + 2, colors.hair);

                // Gesicht
                for(let x = 2; x < 6; x++) {
                    for(let y = 3; y < 6; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.skin);
                    }
                }

                // Augen
                drawPixel(offsetX + 2, offsetY + 4, colors.outline);
                drawPixel(offsetX + 5, offsetY + 4, colors.outline);

                // Uniform Oberteil
                for(let x = 1; x < 7; x++) {
                    for(let y = 6; y < 9; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.uniform : colors.uniformLight);
                    }
                }

                // Hose
                for(let x = 2; x < 6; x++) {
                    for(let y = 9; y < 11; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.pants : colors.pantsLight);
                    }
                }

                // Stiefel
                for(let x = 2; x < 6; x++) {
                    drawPixel(offsetX + x, offsetY + 11, colors.boots);
                }
                drawPixel(offsetX + 2, offsetY + 10, colors.bootsLight);
                drawPixel(offsetX + 5, offsetY + 10, colors.bootsLight);

                break;

            case 'down':
                // Haare (mit Helm-Form)
                for(let x = 1; x < 7; x++) {
                    for(let y = 0; y < 4; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.hair);
                    }
                }
                drawPixel(offsetX + 0, offsetY + 1, colors.hair);
                drawPixel(offsetX + 7, offsetY + 1, colors.hair);
                drawPixel(offsetX + 0, offsetY + 2, colors.hair);
                drawPixel(offsetX + 7, offsetY + 2, colors.hair);

                // Gesicht
                for(let x = 2; x < 6; x++) {
                    for(let y = 3; y < 6; y++) {
                        drawPixel(offsetX + x, offsetY + y, colors.skin);
                    }
                }

                // Augen
                drawPixel(offsetX + 2, offsetY + 4, colors.outline);
                drawPixel(offsetX + 5, offsetY + 4, colors.outline);

                // Uniform Oberteil
                for(let x = 1; x < 7; x++) {
                    for(let y = 6; y < 9; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.uniform : colors.uniformLight);
                    }
                }

                // Hose
                for(let x = 2; x < 6; x++) {
                    for(let y = 9; y < 11; y++) {
                        drawPixel(offsetX + x, offsetY + y, y % 2 === 0 ? colors.pants : colors.pantsLight);
                    }
                }

                // Stiefel
                for(let x = 2; x < 6; x++) {
                    drawPixel(offsetX + x, offsetY + 11, colors.boots);
                }
                drawPixel(offsetX + 2, offsetY + 10, colors.bootsLight);
                drawPixel(offsetX + 5, offsetY + 10, colors.bootsLight);

                break;
        }
        
        // Flagge, wenn vorhanden
        if (hasFlag) {
            const flagOffsetX = direction === 'left' ? -8 : 12;
            const flagOffsetY = -8;
            
            // Flaggenstab
            drawPixel(offsetX + flagOffsetX, offsetY + flagOffsetY, colors.outline);
            drawPixel(offsetX + flagOffsetX, offsetY + flagOffsetY + 1, colors.outline);
            drawPixel(offsetX + flagOffsetX, offsetY + flagOffsetY + 2, colors.outline);
            drawPixel(offsetX + flagOffsetX, offsetY + flagOffsetY + 3, colors.outline);
            
            // Flagge
            const flagColor = team === 'red' ? '#FF0000' : '#0000FF';
            for(let y = 0; y < 4; y++) {
                for(let x = 1; x < 4; x++) {
                    drawPixel(offsetX + flagOffsetX + x, offsetY + flagOffsetY + y, flagColor);
                }
            }
        }
        
        ctx.restore();
    },

    drawMedikit(x, y) {
        ctx.save();
        ctx.translate(x, y);
        
        // Hauptkörper mit Schatten
        ctx.fillStyle = '#cc3333';
        ctx.fillRect(-15, -15, 30, 30);
        
        // Glanz
        ctx.fillStyle = '#ff6666';
        ctx.beginPath();
        ctx.moveTo(-15, -15);
        ctx.lineTo(15, -15);
        ctx.lineTo(15, 15);
        ctx.lineTo(-15, 15);
        ctx.closePath();
        ctx.fill();
        
        // Kreuz mit Schatten
        ctx.fillStyle = '#cc3333';
        ctx.fillRect(-5, -15, 10, 30);
        ctx.fillRect(-15, -5, 30, 10);
        
        // Weißes Kreuz
        ctx.fillStyle = 'white';
        ctx.fillRect(-4, -14, 8, 28);
        ctx.fillRect(-14, -4, 28, 8);
        
        // Glanz auf dem Kreuz
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-4, -14, 8, 4);
        ctx.fillRect(-14, -4, 4, 8);
        
        ctx.restore();
    },

    drawArmor(x, y) {
        ctx.save();
        ctx.translate(x, y);
        
        // Weste Grundform (taktische Weste)
        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(-15, 15);
        ctx.lineTo(15, 15);
        ctx.closePath();
        ctx.fill();
        
        // Westen-Details (Taschen und Verschlüsse)
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 2;
        
        // Haupttaschen
        ctx.fillStyle = '#555555';
        ctx.fillRect(-12, -10, 8, 12);
        ctx.fillRect(4, -10, 8, 12);
        
        // Seitentaschen
        ctx.fillRect(-14, 0, 6, 8);
        ctx.fillRect(8, 0, 6, 8);
        
        // Verschlüsse
        ctx.fillStyle = '#444444';
        // Obere Verschlüsse
        ctx.fillRect(-2, -15, 4, 4);
        ctx.fillRect(-2, -10, 4, 4);
        // Mittlere Verschlüsse
        ctx.fillRect(-2, -5, 4, 4);
        ctx.fillRect(-2, 0, 4, 4);
        // Untere Verschlüsse
        ctx.fillRect(-2, 5, 4, 4);
        ctx.fillRect(-2, 10, 4, 4);
        
        // Taktische Linien
        ctx.strokeStyle = '#777777';
        ctx.lineWidth = 1;
        // Horizontale Linien
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.lineTo(12, -10);
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.moveTo(-12, 10);
        ctx.lineTo(12, 10);
        ctx.stroke();
        
        // Vertikale Linien
        ctx.beginPath();
        ctx.moveTo(-8, -15);
        ctx.lineTo(-8, 15);
        ctx.moveTo(0, -15);
        ctx.lineTo(0, 15);
        ctx.moveTo(8, -15);
        ctx.lineTo(8, 15);
        ctx.stroke();
        
        // Glanz
        ctx.fillStyle = '#999999';
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.closePath();
        ctx.fill();
        
        // Taschen-Details
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
        // Haupttaschen
        ctx.strokeRect(-12, -10, 8, 12);
        ctx.strokeRect(4, -10, 8, 12);
        // Seitentaschen
        ctx.strokeRect(-14, 0, 6, 8);
        ctx.strokeRect(8, 0, 6, 8);
        
        ctx.restore();
    },

    drawFlag(x, y) {
        ctx.save();
        ctx.translate(x, y);
        
        // Flaggenmast mit Schatten
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(-2, -30, 4, 30);
        
        // Flaggenmast Glanz
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-1, -30, 2, 30);
        
        // Flagge mit Schatten
        ctx.fillStyle = '#ccaa00';
        ctx.beginPath();
        ctx.moveTo(2, -30);
        ctx.lineTo(2, -20);
        ctx.lineTo(12, -25);
        ctx.closePath();
        ctx.fill();
        
        // Flaggenmuster mit Schatten
        ctx.fillStyle = '#cc8800';
        ctx.beginPath();
        ctx.moveTo(2, -30);
        ctx.lineTo(2, -20);
        ctx.lineTo(7, -25);
        ctx.closePath();
        ctx.fill();
        
        // Flaggen-Details
        ctx.strokeStyle = '#aa8800';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(2, -30);
        ctx.lineTo(12, -25);
        ctx.moveTo(2, -25);
        ctx.lineTo(12, -20);
        ctx.stroke();
        
        ctx.restore();
    },

    drawProjectile(x, y, classType) {
        ctx.save();
        ctx.translate(x, y);
        
        // Äußeres Glühen für alle Projektile
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
        
        switch(classType) {
            case 'sniper':
                // Verbessertes Sniper-Projektil
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                
                // Innerer heller Kern
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Leuchtender Schweif
                ctx.strokeStyle = '#ff6666';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-8, 0);
                ctx.lineTo(8, 0);
                ctx.stroke();
                break;
                
            case 'shotgun':
                // Shotgun-Projektil
                ctx.fillStyle = '#ffa500';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // Inneres Muster
                ctx.fillStyle = '#ff8c00';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Kreuzförmiges Leuchten
                ctx.strokeStyle = '#ffff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-6, 0);
                ctx.lineTo(6, 0);
                ctx.moveTo(0, -6);
                ctx.lineTo(0, 6);
                ctx.stroke();
                break;
                
            default:
                // klassisches Projektil
                ctx.fillStyle = '#4444ff';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                
                // Heller Kern
                ctx.fillStyle = '#8888ff';
                ctx.beginPath();
                ctx.arc(0, 0, 2, 0, Math.PI * 2);
                ctx.fill();
                
                // Leuchtender Ring
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.stroke();
        }
        
        ctx.restore();
    },

    game() {
        this.clear();
        
        // Zeichne Hintergrund
        this.rect(0, 0, canvas.width, canvas.height, '#2d5a27', terrainPatterns.grass);

        // Zeichne statische Reifenspuren
        gameState.staticDecorations.tireTrackPositions.forEach(pos => {
            drawTireTracks(ctx, pos.x, pos.y);
        });

        // Zeichne statische Granatkrater
        gameState.staticDecorations.craterPositions.forEach(pos => {
            drawExplosionCrater(ctx, pos.x, pos.y);
        });


        // Zeichne gecachte Dekorationen
        terrainPatterns.cachedDecorations.forEach(decor => {
            ctx.drawImage(decor.canvas, decor.x, decor.y);
        });

        // Zeichne Wände mit Textur und Schatten
        gameState.walls.forEach(w => {
            this.rect(w.x, w.y, w.width, w.height, 'grey', terrainPatterns.concrete, true);
            // Füge Sandsäcke an den Wänden hinzu
            if (w.width > w.height) {
                for (let x = w.x; x < w.x + w.width; x += 30) {
                    this.drawSandbag(x, w.y - 15, 25, 15);
                    this.drawSandbag(x, w.y + w.height, 25, 15);
                }
            } else {
                for (let y = w.y; y < w.y + w.height; y += 20) {
                    this.drawSandbag(w.x - 15, y, 15, 25);
                    this.drawSandbag(w.x + w.width, y, 15, 25);
                }
            }
        });

        // Zeichne Basen
        this.drawBase(gameState.redSpawn.x, gameState.redSpawn.y, 120, 'red');
        this.drawBase(gameState.blueSpawn.x, gameState.blueSpawn.y, 120, 'blue');

        // Zeichne Spieler mit der neuen Statusanzeige
        Object.values(gameState.players).forEach(p => {
            if (p.speedBoostActive) {
                ctx.save();
                ctx.shadowColor = '#0000ff';
                ctx.shadowBlur = 20;
                this.drawWarrior(p.x, p.y, p.team, p.hasFlag);
                ctx.restore();
            } else {
                this.drawWarrior(p.x, p.y, p.team, p.hasFlag);
            }
            
            drawPlayerStatus(ctx, p);
            
            // Spielername mit Schatten
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'black';
            ctx.fillText(p.username, p.x, p.y - 35);
            ctx.fillStyle = 'white';
            ctx.fillText(p.username, p.x, p.y - 36);
        });

        // Zeichne Projektile mit Leuchteffekt
        gameState.projectiles.forEach(p => {
            ctx.save();
            ctx.shadowColor = p.class === 'sniper' ? '#ff0000' : 
                            p.class === 'shotgun' ? '#ff8800' : '#ffffff';
            ctx.shadowBlur = 10;
            this.drawProjectile(p.x, p.y, p.class);
            ctx.restore();
        });

        // Zeichne Flagge mit Leuchteffekt wenn nicht getragen
        if (!gameState.flag.holder) {
            ctx.save();
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 20;
            this.drawFlag(gameState.flag.x, gameState.flag.y);
            ctx.restore();
        }

        // Zeichne Items mit Leuchteffekt
        gameState.medikits.forEach(m => {
            if (m.active) {
                ctx.save();
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 15;
                this.drawMedikit(m.x, m.y);
                ctx.restore();
            }
        });
        
        gameState.armors.forEach(a => {
            if (a.active) {
                ctx.save();
                ctx.shadowColor = '#0000ff';
                ctx.shadowBlur = 15;
                this.drawArmor(a.x, a.y);
                ctx.restore();
            }
        });


        // Zeichne Speed-Booster
        if (gameState.speedBoosters) {
            gameState.speedBoosters.forEach(b => {
                if (b.active) {
                    ctx.save();
                    ctx.shadowColor = '#0000ff';
                    ctx.shadowBlur = 10;
                    drawSpeedBooster(ctx, b.x, b.y);
                    ctx.restore();
                }
            });
        }

        // Score-Anzeige mit besserem Styling
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(canvas.width - 200, 10, 190, 40);
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4444';
        ctx.fillText(`${gameState.score.red}`, canvas.width - 160, 38);
        ctx.fillStyle = 'white';
        ctx.fillText(`-`, canvas.width - 105, 38);
        ctx.fillStyle = '#4444ff';
        ctx.fillText(`${gameState.score.blue}`, canvas.width - 50, 38);
        ctx.restore();
    }
};

// Event Handlers
const handlers = {
    shoot() {
        if (gameState.canShoot) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            // Berechne die Mausposition relativ zur Canvas-Größe
            const mouseX = (gameState.mouseX - rect.left) * scaleX;
            const mouseY = (gameState.mouseY - rect.top) * scaleY;
            
            // Berechne den Winkel basierend auf der skalierten Position
            const angle = Math.atan2(
                mouseY - gameState.playerY,
                mouseX - gameState.playerX
            );
            
            socket.emit('shoot', { angle });
            gameState.canShoot = false;
            setTimeout(() => gameState.canShoot = true, 500);
        }
    },

    move(event) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        // Aktualisiere die Mausposition
        gameState.mouseX = event.clientX;
        gameState.mouseY = event.clientY;
        
        // Berechne die relative Position für die Schussrichtung
        const relativeX = (event.clientX - rect.left) * scaleX;
        const relativeY = (event.clientY - rect.top) * scaleY;
        
        // Aktualisiere die Spielerrichtung
        if (gameState.players[socket.id]) {
            const player = gameState.players[socket.id];
            const angle = Math.atan2(
                relativeY - player.y,
                relativeX - player.x
            );
            player.angle = angle;
        }
    },

    keyDown(e) {
        const chatInput = document.getElementById('chatInput');
        if (document.activeElement === chatInput) return;

        if (["w", "a", "s", "d", "W", "A", "S", "D"].includes(e.key)) {
            gameState.keys[e.key.toLowerCase()] = true; 
        } else if (e.key === " ") {
            this.shoot();
        }
    },

    keyUp(e) {
        if (["w", "a", "s", "d", "W", "A", "S", "D"].includes(e.key)) {
            gameState.keys[e.key.toLowerCase()] = false;
        }
    },

    // Füge eine neue Funktion für die kontinuierliche Aktualisierung hinzu
    updatePlayerDirection() {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        if (gameState.players[socket.id]) {
            const player = gameState.players[socket.id];
            const relativeX = (gameState.mouseX - rect.left) * scaleX;
            const relativeY = (gameState.mouseY - rect.top) * scaleY;
            
            player.angle = Math.atan2(
                relativeY - player.y,
                relativeX - player.x
            );
        }
    }
};

// Hauptspiel-Loop
function gameLoop() {
    const player = gameState.players[socket.id];
    if (player) {
        // Aktualisiere die Spielerrichtung
        handlers.updatePlayerDirection();
        
        Object.entries(gameState.keys).forEach(([key, pressed]) => {
            const normalizedKey = key.toLowerCase(); 
            if (pressed) {
                const baseSpeed = player.speedBoostActive ? 6 : 3;
                socket.emit('move', { 
                     dx: normalizedKey === 'a' ? -baseSpeed : normalizedKey === 'd' ? baseSpeed : 0,
                     dy: normalizedKey === 'w' ? -baseSpeed : normalizedKey === 's' ? baseSpeed : 0
                });
            }
        });
    }
    render.game();
    requestAnimationFrame(gameLoop);
}

// Team-Auswahl
window.chooseTeam = async (team) => {
    const usernameInput = document.getElementById('username');
    const username = usernameInput?.value.trim();

    if (!username) {
        alert("Bitte gib einen Namen ein!");
        return;
    }

    
    console.log(`📢 Sende Team-Wahl: { username: "${username}", team: "${team}" }`);

    try {
        // Sende Team-Wahl an Server
        socket.emit('chooseTeam', { 
            username, 
            team, 
            class: gameState.selectedClass 
        });

        // UI wechseln
        document.getElementById('teamSelection').style.display = 'none';
        document.getElementById('gameCanvas').style.display = 'block';

    } catch (error) {
        console.error("❌ Fehler bei der Team-Auswahl:", error);
        alert("Fehler bei der Team-Auswahl. Bitte versuche es erneut.");
    }
};
// Klassenauswahl
window.selectClass = className => {
    gameState.selectedClass = className;
    const classButtons = document.querySelectorAll('.class-button');
    classButtons.forEach(btn => btn.classList.remove('selected'));
    document.getElementById(`${className}Button`).classList.add('selected');
    
    // Aktualisiere die Beschreibung
    const description = document.getElementById('classDescription');
    description.textContent = CLASSES[className].description; 
};

// Socket Events
socket.on('state', state => {
    Object.assign(gameState, state);
    if (socket.id in state.players) {
        gameState.playerX = state.players[socket.id].x;
        gameState.playerY = state.players[socket.id].y;
    }
    if (!gameState.gameRunning) {
        gameState.gameRunning = true;
        gameLoop();
    }
});

socket.on('chatUpdate', messages => {
    const chat = document.getElementById('chatMessages');
    chat.innerHTML = messages.map(msg => `<li>${msg}</li>`).join('');
    chat.scrollTop = chat.scrollHeight;
});

socket.on('updateMedikits', medikits => gameState.medikits = medikits);
socket.on('updateArmors', armors => gameState.armors = armors);
socket.on('gameOver', winner => {
    alert(`${winner === 'red' ? 'Rotes' : 'Blaues'} Team hat gewonnen!`);
    location.reload();
});

socket.on('updateSpeedBoosters', boosters => gameState.speedBoosters = boosters);
socket.on('itemPickup', data => {
    // Optional: Soundeffekt oder visuelle Bestätigung
    switch(data.type) {
        case 'speedBoost':
            console.log('Speed-Boost aktiviert');
            // Hier könnte ein Soundeffekt abgespielt werden
            break;
    }
});

socket.on('speedBoostActive', duration => {
    const player = gameState.players[socket.id];
    if (player) {
        player.speedBoostActive = true;
        player.speedBoostEndTime = Date.now() + duration;

        // Entferne alten Speed-Boost-Timer falls vorhanden
        const oldTimer = document.getElementById('speedBoostTimer');
        if (oldTimer) oldTimer.remove();

        // Erstelle neuen Timer
        const timerDiv = document.createElement('div');
        timerDiv.id = 'speedBoostTimer';
        timerDiv.style.position = 'fixed';
        timerDiv.style.top = '70px';
        timerDiv.style.right = '20px';
        timerDiv.style.backgroundColor = 'rgba(0, 0, 255, 0.3)';
        timerDiv.style.padding = '10px';
        timerDiv.style.borderRadius = '5px';
        timerDiv.style.color = 'white';
        timerDiv.style.fontWeight = 'bold';
        document.body.appendChild(timerDiv);

        // Aktualisiere Timer
        const updateTimer = () => {
            const timeLeft = Math.max(0, Math.ceil((player.speedBoostEndTime - Date.now()) / 1000));
            if (timeLeft > 0) {
                timerDiv.textContent = `⚡ Speed-Boost: ${timeLeft}s`;
                requestAnimationFrame(updateTimer);
            } else {
                timerDiv.remove();
            }
        };
        updateTimer();
    }
});


// Funktion zum Zeichnen eines Herzens
function drawHeart(ctx, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.3);
    ctx.bezierCurveTo(
        x, y, 
        x - size * 0.5, y, 
        x - size * 0.5, y + size * 0.3
    );
    ctx.bezierCurveTo(
        x - size * 0.5, y + size * 0.6, 
        x, y + size * 0.8, 
        x, y + size * 0.8
    );
    ctx.bezierCurveTo(
        x, y + size * 0.8, 
        x + size * 0.5, y + size * 0.6, 
        x + size * 0.5, y + size * 0.3
    );
    ctx.bezierCurveTo(
        x + size * 0.5, y, 
        x, y, 
        x, y + size * 0.3
    );
    ctx.fill();
    ctx.restore();
}

// Cache für Dekorationen erstellen
function createDecorationCache() {
    // Erstelle 30 vordefinierte Dekorationen
    for (let i = 0; i < 30; i++) {
        const decorCanvas = document.createElement('canvas');
        decorCanvas.width = 50;
        decorCanvas.height = 50;
        const decorCtx = decorCanvas.getContext('2d');
        
        const type = ['crater', 'crater', 'crater', 'sandbag', 'barbed'][Math.floor(Math.random() * 5)];
        const x = 25;
        const y = 25;
        
        switch(type) {
            case 'crater':
                decorCtx.beginPath();
                decorCtx.arc(x, y, 15 + Math.random() * 10, 0, Math.PI * 2);
                decorCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                decorCtx.fill();
                break;
            case 'sandbag':
                render.drawSandbag(decorCtx, x, y, 25, 15);
                break;
            case 'barbed':
                render.drawBarbed(decorCtx, x, y, 50);
                break;
        }
        
        terrainPatterns.cachedDecorations.push({
            canvas: decorCanvas,
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
        });
    }
}

// Funktion für Reifenspuren
function drawTireTracks(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 8;
    
    // Geschwungene Reifenspur
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
        x + 50, y - 20,
        x + 100, y + 20,
        x + 150, y
    );
    ctx.stroke();
    
    // Parallele Spur
    ctx.beginPath();
    ctx.moveTo(x, y + 15);
    ctx.bezierCurveTo(
        x + 50, y - 5,
        x + 100, y + 35,
        x + 150, y + 15
    );
    ctx.stroke();
    ctx.restore();
}

// Funktion für Granatkrater
function drawExplosionCrater(ctx, x, y) {
    ctx.save();
    // Hauptkrater
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
    
    // Kraterrand
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();
}




function drawSpeedBooster(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    
    // Dosen-Körper
    ctx.fillStyle = '#1E90FF';
    ctx.fillRect(-6, -12, 12, 24);
    
    // Glanzeffekt
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-4, -10, 3, 20);
    
    // Logo/Text
    ctx.fillStyle = '#FFD700';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', 0, 0);
    
    // Dosendeckel
    ctx.fillStyle = '#4169E1';
    ctx.beginPath();
    ctx.ellipse(0, -12, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// Füge CSS für den Pulseffekt hinzu
const style = document.createElement('style');
style.textContent = `
@keyframes pulse {
    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.3; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
}`;
document.head.appendChild(style);

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');

    // Setze initiale Werte für Cooldowns
    gameState.canShoot = true;

    document.addEventListener('keydown', e => handlers.keyDown.call(handlers, e));
    document.addEventListener('keyup', e => handlers.keyUp.call(handlers, e));
    canvas.addEventListener('mousemove', e => handlers.move(e));
    canvas.addEventListener('mousedown', () => handlers.shoot());

    chatForm.addEventListener('submit', e => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (message) {
            socket.emit('chatMessage', message);
            chatInput.value = '';
        }
    });

    chatInput.addEventListener('focus', () => {
        Object.keys(gameState.keys).forEach(key => gameState.keys[key] = false);
    });

    createTerrainPatterns();
    createDecorationCache(); // Erstelle Cache für Dekorationen
    initializeStaticDecorations(); // Initialisiere statische Dekorationen
});

// Initialisierung der statischen Dekorationen
function initializeStaticDecorations() {
    // Reifenspuren
    for (let i = 0; i < 5; i++) {
        gameState.staticDecorations.tireTrackPositions.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
        });
    }

    // Granatkrater
    for (let i = 0; i < 8; i++) {
        gameState.staticDecorations.craterPositions.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
        });
    }

}

// Statusanzeige mit nebeneinander liegenden Herzen
function drawPlayerStatus(ctx, player) {
    ctx.save();
    
    // Hintergrund für Statusanzeige
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.roundRect(player.x - 30, player.y + 20, 60, 12, 5);
    ctx.fill();
    
    // Zeichne Leben und Rüstung direkt nebeneinander
    let xOffset = player.x - 25;
    for (let i = 0; i < player.health; i++) {
        // Rotes Herz
        drawHeart(ctx, xOffset, player.y + 25, 8, '#ff4444');
        // Blaues Herz (Rüstung) direkt daneben, falls vorhanden
        if (i < player.armor) {
            drawHeart(ctx, xOffset + 10, player.y + 25, 8, '#4444ff');
        }
        xOffset += 20; // Mehr Platz für beide Herzen nebeneinander
    }
    
    ctx.restore();
}





