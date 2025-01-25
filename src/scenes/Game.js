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
        if (this.isDragging && this.canMove) {
            const deltaX = pointer.x - this.dragStartPointerX;
            const deltaY = pointer.y - this.dragStartPointerY;

            // Increase drag threshold for mobile
            const dragThreshold = 10;

            if (this.dragDirection === null) {
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > dragThreshold) {
                    this.dragDirection = 'row';
                    const y = this.dragStartY;
                    
                    for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                        const sprite = this.gemsSprites[x][y];
                        this.draggingSprites.push(sprite);
                        this.dragStartPositions.push({
                            x: sprite.x,
                            gridX: x,
                            y: sprite.y,
                            gridY: y
                        });
                    }
                } else if (Math.abs(deltaY) > dragThreshold) {
                    this.dragDirection = 'col';
                    const x = this.dragStartX;
                    
                    for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                        const sprite = this.gemsSprites[x][y];
                        this.draggingSprites.push(sprite);
                        this.dragStartPositions.push({
                            x: sprite.x,
                            gridX: x,
                            y: sprite.y,
                            gridY: y
                        });
                    }
                }
            }

            if (this.dragDirection === 'row') {
                const totalWidth = this.GRID_SIZE.cols * this.GEM_SIZE;
                const newPositions = [];
                
                // Calculate grid-based movement
                const rawGridOffset = deltaX / this.GEM_SIZE;
                const gridOffset = Math.abs(rawGridOffset % 1) < 0.2 ?
                    Math.round(rawGridOffset) :
                    Math.floor(rawGridOffset);
                
                // Handle wrap-around
                const effectiveOffset = ((gridOffset % this.GRID_SIZE.cols) + this.GRID_SIZE.cols) % this.GRID_SIZE.cols;
                
                // Calculate sub-grid movement
                let remainder = deltaX - (gridOffset * this.GEM_SIZE);
                
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    const startPos = this.dragStartPositions[i];
                    
                    let newGridX = startPos.gridX + effectiveOffset;
                    if (newGridX < 0) newGridX += this.GRID_SIZE.cols;
                    newGridX = newGridX % this.GRID_SIZE.cols;
                    
                    const baseX = Math.round(this.BOARD_OFFSET.x + (newGridX * this.GEM_SIZE) + this.GEM_SIZE / 2);
                    // Snap to grid positions during drag
                    if (Math.abs(remainder) < this.GEM_SIZE * 0.2) {
                        remainder = 0;
                    }
                    const newX = Math.round(baseX + remainder);
                    
                    if (this.draggingSprites[i]) {
                        this.draggingSprites[i].x = newX;
                        newPositions.push(newX);
                        // Update grid position
                        this.draggingSprites[i].gridX = newGridX;
                    }
                }
                this.dragCurrentPositions = newPositions;

            } else if (this.dragDirection === 'col') {
                const totalHeight = this.GRID_SIZE.rows * this.GEM_SIZE;
                const newPositions = [];
                
                // Calculate grid-based movement
                const rawGridOffset = deltaY / this.GEM_SIZE;
                const gridOffset = Math.abs(rawGridOffset % 1) < 0.2 ?
                    Math.round(rawGridOffset) :
                    Math.floor(rawGridOffset);
                
                // Handle wrap-around
                const effectiveOffset = ((gridOffset % this.GRID_SIZE.rows) + this.GRID_SIZE.rows) % this.GRID_SIZE.rows;
                
                // Calculate sub-grid movement
                let remainder = deltaY - (gridOffset * this.GEM_SIZE);
                
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    const startPos = this.dragStartPositions[i];
                    
                    let newGridY = startPos.gridY + effectiveOffset;
                    if (newGridY < 0) newGridY += this.GRID_SIZE.rows;
                    newGridY = newGridY % this.GRID_SIZE.rows;
                    
                    const baseY = Math.round(this.BOARD_OFFSET.y + (newGridY * this.GEM_SIZE) + this.GEM_SIZE / 2);
                    // Snap to grid positions during drag
                    if (Math.abs(remainder) < this.GEM_SIZE * 0.2) {
                        remainder = 0;
                    }
                    const newY = Math.round(baseY + remainder);
                    
                    if (this.draggingSprites[i]) {
                        this.draggingSprites[i].y = newY;
                        newPositions.push(newY);
                        // Update grid position
                        this.draggingSprites[i].gridY = newGridY;
                    }
                }
                this.dragCurrentPositions = newPositions;
            }
        }
    }

    onPointerUp(pointer) {
        if (this.isDragging && this.canMove) {
            const deltaX = pointer.x - this.dragStartPointerX;
            const deltaY = pointer.y - this.dragStartPointerY;

            let moveAction = null;

            if (this.dragDirection === 'row' && this.draggingSprites.length > 0) {
                // Calculate amount based on actual grid position change
                const firstSprite = this.draggingSprites[0];
                const startGridX = this.dragStartPositions[0].gridX;
                const currentGridX = firstSprite.gridX;
                const amount = currentGridX - startGridX;
                
                // Wrap around handling
                if (amount !== 0) {
                    let wrappedAmount = amount;
                    if (Math.abs(amount) > this.GRID_SIZE.cols / 2) {
                        wrappedAmount = amount > 0 ?
                            amount - this.GRID_SIZE.cols :
                            amount + this.GRID_SIZE.cols;
                    }
                    moveAction = new MoveAction('row', this.dragStartY, wrappedAmount);
                }
            } else if (this.dragDirection === 'col' && this.draggingSprites.length > 0) {
                // Calculate amount based on actual grid position change
                const firstSprite = this.draggingSprites[0];
                const startGridY = this.dragStartPositions[0].gridY;
                const currentGridY = firstSprite.gridY;
                const amount = currentGridY - startGridY;
                
                // Wrap around handling
                if (amount !== 0) {
                    let wrappedAmount = amount;
                    if (Math.abs(amount) > this.GRID_SIZE.rows / 2) {
                        wrappedAmount = amount > 0 ?
                            amount - this.GRID_SIZE.rows :
                            amount + this.GRID_SIZE.rows;
                    }
                    moveAction = new MoveAction('col', this.dragStartX, -wrappedAmount);
                }
            }

            if (moveAction) {
                this.canMove = false;
                // Store current positions before applying move
                const currentPositions = this.draggingSprites.map(sprite => ({
                    x: Math.round(sprite.x),
                    y: Math.round(sprite.y)
                }));

                // Update backend state
                this.backendPuzzle.applyMoveToGrid(this.backendPuzzle.puzzleState, moveAction);

                // Update sprite positions to match current drag positions
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    const sprite = this.draggingSprites[i];
                    sprite.x = Math.round(currentPositions[i].x);
                    sprite.y = Math.round(currentPositions[i].y);
                }

                this.applyMove(moveAction).then(() => {
                    this.clearDragState();
                });
            } else {
                // No valid move, snap back
                this.snapBack().then(() => {
                    this.clearDragState();
                });
            }
        }
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

    clearDragState() {
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