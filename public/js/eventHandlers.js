import { GAME_CONSTANTS } from './config.js';

export class EventHandler {
    constructor(socket, gameState) {
        this.socket = socket;
        this.gameState = gameState;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Tastatur-Events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        
        // Maus-Events
        document.addEventListener('mousemove', this.move.bind(this));
        document.addEventListener('click', this.handleClick.bind(this));
        
        // Speed-Booster Event
        this.socket.on('speedBoostActive', (duration) => {
            const player = this.gameState.players[this.gameState.socketId];
            if (player) {
                player.speedBoostActive = true;
                player.speedBoostEndTime = performance.now() + duration;
            }
        });
    }

    handleClick(event) {
        const player = this.gameState.players[this.gameState.socketId];
        if (player?.canShoot) {
            this.shoot();
        }
    }

    move(event) {
        const rect = event.target.getBoundingClientRect();
        this.gameState.mouseX = event.clientX - rect.left;
        this.gameState.mouseY = event.clientY - rect.top;
    }

    handleKeyDown(e) {
        if (["w", "a", "s", "d"].includes(e.key)) {
            this.gameState.keys[e.key] = true;
        } else if (e.key === " " && this.gameState.players[this.gameState.socketId]?.canShoot) {
            this.shoot();
        }
    }

    handleKeyUp(e) {
        if (["w", "a", "s", "d"].includes(e.key)) {
            this.gameState.keys[e.key] = false;
        }
    }

    shoot() {
        const player = this.gameState.players[this.gameState.socketId];
        if (!player || !player.canShoot) return;

        const angle = Math.atan2(
            this.gameState.mouseY - player.y,
            this.gameState.mouseX - player.x
        );
        this.socket.emit('shoot', { angle });
    }
} 