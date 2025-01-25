// Game.js
import Phaser from 'phaser';
import { BackendPuzzle } from './BackendPuzzle';
import { MoveAction } from './MoveAction';

const GEM_TYPES = ['black', 'blue', 'green', 'orange', 'red', 'white'];

export class Game extends Phaser.Scene {
    constructor() {
        super('Game');

        this.GRID_SIZE = {
            cols: 7,
            rows: 8
        };

        // Will be set in create() based on screen size
        this.GEM_SIZE = 30;
        this.BOARD_OFFSET = { x: 0, y: 0 };
    }

    preload() {
        this.loadAssets();
    }

    create() {
        // Enable multi-touch
        this.input.addPointer(2);
        
        // Prevent default touch behaviors
        this.game.canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
        }, false);

        // Handle orientation changes
        this.scale.on('orientationchange', (orientation) => {
            this.handleOrientationChange(orientation);
        });

        // Calculate board dimensions based on screen size
        this.calculateBoardDimensions();

        // Initialize game variables
        this.backendPuzzle = new BackendPuzzle(this.GRID_SIZE.cols, this.GRID_SIZE.rows);

        // Create the board
        this.createBoard();

        // Set up input handling with touch support
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);

        this.isDragging = false;
        this.canMove = true;

        // For real-time dragging
        this.draggingSprites = [];
        this.dragDirection = null;
        this.dragStartPointerX = 0;
        this.dragStartPointerY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartPositions = [];
        this.dragCurrentPositions = [];

        // For wrapping around
        this.wrapOffset = 0;
    }

    calculateBoardDimensions() {
        const width = this.scale.gameSize.width;
        const height = this.scale.gameSize.height;
        
        // Calculate gem size based on screen dimensions and grid
        const maxGemSizeWidth = Math.floor(width * 0.9 / this.GRID_SIZE.cols);
        const maxGemSizeHeight = Math.floor(height * 0.9 / this.GRID_SIZE.rows);
        this.GEM_SIZE = Math.min(maxGemSizeWidth, maxGemSizeHeight);

        // Center the board
        this.BOARD_OFFSET = {
            x: (width - (this.GRID_SIZE.cols * this.GEM_SIZE)) / 2,
            y: (height - (this.GRID_SIZE.rows * this.GEM_SIZE)) / 2
        };
    }

    handleOrientationChange(orientation) {
        // Recalculate board dimensions
        this.calculateBoardDimensions();
        
        // Update all gem positions with tweens
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                const sprite = this.gemsSprites[x][y];
                if (sprite) {
                    const xPos = Math.round(this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2);
                    const yPos = Math.round(this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2);
                    this.tweens.add({
                        targets: sprite,
                        x: xPos,
                        y: yPos,
                        duration: 100,
                        ease: 'Linear'
                    });
                }
            }
        }
    }

    loadAssets() {
        // Load gem images
        for (let type of GEM_TYPES) {
            for (let i = 0; i < 8; i++) {
                this.load.image(`${type}_gem_${i}`, `assets/${type}_gem_${i}.png`);
            }
        }
    }

    createBoard() {
        this.gemsSprites = []; // 2D array [x][y] = sprite

        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            this.gemsSprites[x] = [];
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                const gem = this.backendPuzzle.puzzleState[x][y];
                const gemType = gem.gemType;

                const xPos = Math.round(this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2);
                const yPos = Math.round(this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2);

                const sprite = this.add.sprite(xPos, yPos, `${gemType}_gem_${0}`);
                sprite.setInteractive();
                this.input.setDraggable(sprite);

                // Scale sprite to fit gem size
                sprite.setDisplaySize(this.GEM_SIZE * 0.9, this.GEM_SIZE * 0.9);

                // Store grid coordinates and gem type using setData
                sprite.gridX = x;
                sprite.gridY = y;
                sprite.setData('gemType', gemType);

                this.gemsSprites[x][y] = sprite;
            }
        }
    }

    onPointerDown(pointer) {
        if (!this.canMove) return;
        
        // Handle both mouse and touch input
        const x = pointer.x;
        const y = pointer.y;

        // Convert screen coordinates to grid coordinates
        const gridX = Math.floor((x - this.BOARD_OFFSET.x) / this.GEM_SIZE);
        const gridY = Math.floor((y - this.BOARD_OFFSET.y) / this.GEM_SIZE);

        if (gridX >= 0 && gridX < this.GRID_SIZE.cols && gridY >= 0 && gridY < this.GRID_SIZE.rows) {
            this.isDragging = true;
            this.dragStartX = gridX;
            this.dragStartY = gridY;
            this.dragDirection = null;
            this.dragStartPointerX = pointer.x;
            this.dragStartPointerY = pointer.y;

            // Store initial positions of the sprites in the row or column
            this.dragStartPositions = [];
            this.draggingSprites = [];
        }
    }

    onPointerMove(pointer) {
        if (!this.isDragging || !this.canMove) return;

        const deltaX = pointer.x - this.dragStartPointerX;
        const deltaY = pointer.y - this.dragStartPointerY;

        if (!this.dragDirection && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 10) {
            // Initial setup remains same
            this.dragDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'row' : 'col';
            
            if (this.dragDirection === 'row') {
                for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                    const sprite = this.gemsSprites[x][this.dragStartY];
                    this.draggingSprites.push(sprite);
                    this.dragStartPositions[x] = {
                        x: sprite.x,
                        y: sprite.y,
                        gridX: x
                    };
                }
            } else {
                for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                    const sprite = this.gemsSprites[this.dragStartX][y];
                    this.draggingSprites.push(sprite);
                    this.dragStartPositions[y] = {
                        x: sprite.x,
                        y: sprite.y,
                        gridY: y
                    };
                }
            }
        }

        if (this.dragDirection === 'row') {
            const width = this.GRID_SIZE.cols * this.GEM_SIZE;
            this.draggingSprites.forEach((sprite, i) => {
                let offset = deltaX;
                
                // Ensure proper wrapping even at edges
                let newX = this.dragStartPositions[i].x + offset;
                const rightEdge = this.BOARD_OFFSET.x + width;
                
                if (newX < this.BOARD_OFFSET.x - this.GEM_SIZE/2) {
                    while (newX < this.BOARD_OFFSET.x - this.GEM_SIZE/2) {
                        newX += width;
                    }
                } else if (newX > rightEdge + this.GEM_SIZE/2) {
                    while (newX > rightEdge + this.GEM_SIZE/2) {
                        newX -= width;
                    }
                }
                
                sprite.x = Math.round(newX);

                // Remove any existing tweens
                if (this.tweens.isTweening(sprite)) {
                    this.tweens.remove(sprite);
                }
            });
        } else if (this.dragDirection === 'col') {
            const height = this.GRID_SIZE.rows * this.GEM_SIZE;
            this.draggingSprites.forEach((sprite, i) => {
                let offset = deltaY;
                let newY = this.dragStartPositions[i].y + offset;
                const bottomEdge = this.BOARD_OFFSET.y + height;
                
                // Mirror the row wrapping logic for columns
                if (newY < this.BOARD_OFFSET.y - this.GEM_SIZE/2) {
                    while (newY < this.BOARD_OFFSET.y - this.GEM_SIZE/2) {
                        newY += height;
                    }
                } else if (newY > bottomEdge + this.GEM_SIZE/2) {
                    while (newY > bottomEdge + this.GEM_SIZE/2) {
                        newY -= height;
                    }
                }
                
                sprite.y = Math.round(newY);

                // Add the tweening
                if (this.tweens.isTweening(sprite)) {
                    this.tweens.remove(sprite);
                }
            });
        }
    }

    onPointerUp(pointer) {
        if (!this.isDragging || !this.canMove) return;

        const deltaX = pointer.x - this.dragStartPointerX;
        const deltaY = pointer.y - this.dragStartPointerY;
        const cellsMoved = this.dragDirection === 'row' ? deltaX / this.GEM_SIZE : deltaY / this.GEM_SIZE;

        if (Math.abs(cellsMoved) >= 0.5) {
            const amount = this.dragDirection === 'row' ?
                Math.round(deltaX / this.GEM_SIZE) :
                -Math.round(deltaY / this.GEM_SIZE);
            const index = this.dragDirection === 'row' ? this.dragStartY : this.dragStartX;
            
            // First snap to grid
            this.draggingSprites.forEach((sprite, i) => {
                if (this.dragDirection === 'row') {
                    const gridX = Math.round((sprite.x - this.BOARD_OFFSET.x) / this.GEM_SIZE);
                    sprite.x = this.BOARD_OFFSET.x + gridX * this.GEM_SIZE + this.GEM_SIZE/2;
                } else {
                    const gridY = Math.round((sprite.y - this.BOARD_OFFSET.y) / this.GEM_SIZE);
                    sprite.y = this.BOARD_OFFSET.y + gridY * this.GEM_SIZE + this.GEM_SIZE/2;
                }
            });

            this.canMove = false;
            this.applyMove(new MoveAction(this.dragDirection, index, amount));
        } else {
            // Return to starting positions with tween
            this.draggingSprites.forEach((sprite, i) => {
                const startPos = this.dragStartPositions[i];
                this.tweens.add({
                    targets: sprite,
                    x: Math.round(startPos.x),
                    y: Math.round(startPos.y),
                    duration: 150,
                    ease: 'Back.easeOut'
                });
            });
        }

        this.isDragging = false;
        this.dragDirection = null;
        this.draggingSprites = [];
        this.dragStartPositions = [];
        this.dragCurrentPositions = [];
    }

    applyMove(moveAction) {
        return new Promise((resolve) => {
            // Get the next phase immediately but don't apply visual changes yet
            const explodeAndReplacePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([moveAction]);

            // Wait for any existing animations to complete
            this.tweens.killAll();

            const settlePromises = [];
            let totalMoveAnimations = 0;

            // Only animate non-dragging sprites
            for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                    const sprite = this.gemsSprites[x][y];
                    if (sprite && !this.draggingSprites.includes(sprite)) {
                        const xPos = Math.round(this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2);
                        const yPos = Math.round(this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2);
                        
                        if (Math.abs(sprite.x - xPos) > 1 || Math.abs(sprite.y - yPos) > 1) {
                            totalMoveAnimations++;
                            settlePromises.push(new Promise((resolveSettle) => {
                                this.tweens.add({
                                    targets: sprite,
                                    x: xPos,
                                    y: yPos,
                                    duration: 200,
                                    ease: 'Back.easeOut',
                                    onComplete: () => {
                                        sprite.x = Math.round(xPos);
                                        sprite.y = Math.round(yPos);
                                        resolveSettle();
                                    }
                                });
                            }));
                        }
                    }
                }
            }

            // Update dragging sprites grid positions without animation
            for (let i = 0; i < this.draggingSprites.length; i++) {
                const sprite = this.draggingSprites[i];
                sprite.x = Math.round(sprite.x);
                sprite.y = Math.round(sprite.y);
            }

            if (totalMoveAnimations > 0) {
                Promise.all(settlePromises).then(() => {
                    if (!explodeAndReplacePhase.isNothingToDo()) {
                        this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements)
                            .then(() => {
                                this.canMove = true;
                                resolve();
                            });
                    } else {
                        this.canMove = true;
                        resolve();
                    }
                });
            } else {
                if (!explodeAndReplacePhase.isNothingToDo()) {
                    this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements)
                        .then(() => {
                            this.canMove = true;
                            resolve();
                        });
                } else {
                    this.canMove = true;
                    resolve();
                }
            }
        });
    }

    cleanupDrag() {
        this.isDragging = false;
        this.dragDirection = null;
        this.draggingSprites = [];
        this.dragStartPositions = [];
        this.dragCurrentPositions = [];
    }

    snapBack() {
        return new Promise(async (resolve) => {
            const settlePromises = [];
            
            for (let i = 0; i < this.draggingSprites.length; i++) {
                const sprite = this.draggingSprites[i];
                const startPos = this.dragStartPositions[i];
                
                // Calculate target position based on original grid position
                const targetX = Math.round(this.BOARD_OFFSET.x + startPos.gridX * this.GEM_SIZE + this.GEM_SIZE / 2);
                const targetY = Math.round(this.BOARD_OFFSET.y + startPos.gridY * this.GEM_SIZE + this.GEM_SIZE / 2);
                
                // Reset grid position
                sprite.gridX = startPos.gridX;
                sprite.gridY = startPos.gridY;
                
                settlePromises.push(new Promise((resolveSettle) => {
                    this.tweens.add({
                        targets: sprite,
                        x: targetX,
                        y: targetY,
                        duration: 200,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            sprite.x = targetX;
                            sprite.y = targetY;
                            resolveSettle();
                        }
                    });
                }));
            }
            
            await Promise.all(settlePromises);
            resolve();
        });
    }

    handleMatches(matches, replacements) {
        return new Promise((resolve) => {
            const destroyPromises = [];
            
            // Collect all sprites to destroy first
            for (let match of matches) {
                for (let [x, y] of match) {
                    const sprite = this.gemsSprites[x][y];
                    if (sprite) {
                        destroyPromises.push(new Promise((resolveDestroy) => {
                            this.tweens.add({
                                targets: sprite,
                                alpha: 0,
                                scale: 0.8,
                                duration: 200,
                                ease: 'Back.easeOut',
                                onComplete: () => {
                                    sprite.destroy();
                                    this.gemsSprites[x][y] = null;
                                    resolveDestroy();
                                }
                            });
                        }));
                    }
                }
            }
            
            // If no sprites to destroy, move directly to falling
            if (destroyPromises.length === 0) {
                this.makeGemsFall(replacements).then(resolve);
                return;
            }

            // Wait for all destroy animations to complete
            Promise.all(destroyPromises).then(() => {
                this.makeGemsFall(replacements).then(resolve);
            });
        });
    }

    makeGemsFall(replacements) {
        return new Promise((resolve) => {
            const fallPromises = [];
            
            // First pass: Create new gems and prepare columns
            for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                const columnSprites = this.gemsSprites[x];
                let newColumnSprites = columnSprites.filter(sprite => sprite !== null);

                const replacementsForCol = replacements.find(r => r[0] === x);
                if (replacementsForCol) {
                    const gemTypes = replacementsForCol[1];
                    for (let i = 0; i < gemTypes.length; i++) {
                        const gemType = gemTypes[i];
                        const xPos = Math.round(this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2);
                        const yPos = Math.round(this.BOARD_OFFSET.y - ((i + 1) * this.GEM_SIZE));
                        const sprite = this.add.sprite(xPos, yPos, `${gemType}_gem_${0}`);
                        
                        // Ensure initial position is rounded
                        sprite.x = Math.round(xPos);
                        sprite.y = Math.round(yPos);
                        
                        sprite.setInteractive();
                        this.input.setDraggable(sprite);
                        sprite.setDisplaySize(this.GEM_SIZE * 0.9, this.GEM_SIZE * 0.9);
                        
                        // Set initial grid position for new gem
                        const initialGridY = -(gemTypes.length - i);
                        sprite.gridX = x;
                        sprite.gridY = initialGridY;
                        sprite.setData('gemType', gemType);
                        sprite.alpha = 0;
                        newColumnSprites.unshift(sprite);
                    }
                }

                this.gemsSprites[x] = newColumnSprites;

                // Second pass: Animate all gems in this column
                for (let y = 0; y < newColumnSprites.length; y++) {
                    const sprite = newColumnSprites[y];
                    sprite.gridY = y;
                    const xPos = Math.round(this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2);
                    const yPos = Math.round(this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2);

                    const fallDistance = Math.abs(sprite.y - yPos);
                    const duration = Math.min(200 + (fallDistance / this.GEM_SIZE * 30), 400);

                    // Update grid position before animation
                    sprite.gridX = x;
                    sprite.gridY = y;
                    
                    fallPromises.push(new Promise((resolveFall) => {
                        // Ensure current position is rounded
                        sprite.x = Math.round(sprite.x);
                        sprite.y = Math.round(sprite.y);
                        
                        this.tweens.add({
                            targets: sprite,
                            x: xPos,
                            y: yPos,
                            alpha: 1,
                            duration: duration,
                            ease: 'Back.easeOut',
                            onComplete: () => {
                                // Ensure final position is rounded and grid position is set
                                sprite.x = Math.round(xPos);
                                sprite.y = Math.round(yPos);
                                sprite.gridX = x;
                                sprite.gridY = y;
                                resolveFall();
                            }
                        });
                    }));
                }
            }

            // Wait for all fall animations to complete
            Promise.all(fallPromises).then(() => {
                const explodeAndReplacePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([]);
                if (!explodeAndReplacePhase.isNothingToDo()) {
                    this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements)
                        .then(resolve);
                } else {
                    resolve();
                }
            });
        });
    }
}