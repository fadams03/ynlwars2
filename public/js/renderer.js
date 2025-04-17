import { CANVAS_CONFIG } from './config.js';

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 30; // 30 FPS
        
        // Einfacher Offscreen Canvas für statische Elemente
        this.staticCanvas = document.createElement('canvas');
        this.staticCanvas.width = CANVAS_CONFIG.width;
        this.staticCanvas.height = CANVAS_CONFIG.height;
        this.staticCtx = this.staticCanvas.getContext('2d');
        
        // Erstelle statische Elemente einmalig
        this.createStaticElements();
    }

    createStaticElements() {
        // Einfacher Hintergrund
        this.staticCtx.fillStyle = '#2d5a27';
        this.staticCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Wände
        this.staticCtx.fillStyle = 'grey';
        walls.forEach(wall => {
            this.staticCtx.fillRect(wall.x, wall.y, wall.width, wall.height);
        });
        
        // Basen
        this.drawBase(this.staticCtx, redSpawn.x, redSpawn.y, 120, 'red');
        this.drawBase(this.staticCtx, blueSpawn.x, blueSpawn.y, 120, 'blue');
    }

    game(gameState) {
        const currentTime = performance.now();
        if (currentTime - this.lastFrameTime < this.frameInterval) return;
        this.lastFrameTime = currentTime;
        
        // Kopiere statische Elemente
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.staticCanvas, 0, 0);
        
        // Zeichne Spieler
        if (gameState.players) {
            Object.values(gameState.players).forEach(player => {
                this.drawPlayer(player);
            });
        }
        
        // Zeichne Projektile
        if (gameState.projectiles) {
            gameState.projectiles.forEach(proj => {
                this.drawProjectile(proj.x, proj.y, proj.class);
            });
        }
    }

    drawPlayer(player) {
        this.ctx.save();
        this.ctx.translate(player.x, player.y);
        
        // Spieler-Körper
        this.ctx.fillStyle = player.team === 'red' ? '#ff4444' : '#4444ff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Speed-Boost Effekt
        if (player.speedBoostActive) {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    drawProjectile(x, y, type) {
        this.ctx.save();
        this.ctx.translate(x, y);
        
        this.ctx.fillStyle = type === 'sniper' ? '#ff0000' : 
                            type === 'shotgun' ? '#ff8800' : '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
} 