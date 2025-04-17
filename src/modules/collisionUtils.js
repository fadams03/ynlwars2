import { border } from './gameConfig.js';

export function checkCollision(x, y, width, height, walls) {
    return walls.some(wall =>
        x < wall.x + wall.width &&
        x + width > wall.x &&
        y < wall.y + wall.height &&
        y + height > wall.y
    );
}

export function checkBorderCollision(x, y, width, height) {
    return x >= border.x && 
           x <= border.x + border.width - width && 
           y >= border.y && 
           y <= border.y + border.height - height;
} 