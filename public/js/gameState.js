import { CANVAS_CONFIG } from './config.js';

export class GameState {
    constructor() {
        this.players = {};
        this.projectiles = [];
        this.walls = [];
        this.flag = {};
        this.score = { red: 0, blue: 0 };
        this.redSpawn = {};
        this.blueSpawn = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.playerX = 0;
        this.playerY = 0;
        this.canShoot = true;
        this.gameRunning = false;
        this.keys = {};
        this.selectedClass = 'classic';
        
        // Performance-Optimierungen
        this.lastUpdate = 0;
        this.updateInterval = 1000 / 30; // 30 FPS
    }

    updateState(state) {
        const currentTime = performance.now();
        if (currentTime - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = currentTime;
        
        // Aktualisiere nur die wichtigsten Werte
        if (state.players) this.players = state.players;
        if (state.projectiles) this.projectiles = state.projectiles;
        if (state.walls) this.walls = state.walls;
        if (state.flag) this.flag = state.flag;
        if (state.score) this.score = state.score;
    }

    activateSpeedBoost(duration) {
        if (this.players[this.socketId]) {
            this.players[this.socketId].speedBoostActive = true;
        }
    }
} 