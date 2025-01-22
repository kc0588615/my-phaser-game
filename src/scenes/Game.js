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

        this.GEM_SIZE = 30;

        this.BOARD_OFFSET = {
            x: (1024 - (this.GRID_SIZE.cols * this.GEM_SIZE)) / 2,
            y: (768 - (this.GRID_SIZE.rows * this.GEM_SIZE)) / 2
        };
    }

    preload() {
        this.loadAssets();
    }

    create() {
        // Initialize game variables
        this.backendPuzzle = new BackendPuzzle(this.GRID_SIZE.cols, this.GRID_SIZE.rows);

        // Create the board
        this.createBoard();

        // Set up input handling
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

                const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;

                const sprite = this.add.sprite(xPos, yPos, `${gemType}_gem_${0}`);
                sprite.setInteractive();
                this.input.setDraggable(sprite); // Make the sprite draggable if needed

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

            // Decide if we're moving a row or a column based on the initial drag
            // For now, we wait until onPointerMove to determine direction
        }
    }

    onPointerMove(pointer) {
        if (this.isDragging && this.canMove) {
            const deltaX = pointer.x - this.dragStartPointerX;
            const deltaY = pointer.y - this.dragStartPointerY;

            if (this.dragDirection === null) {
                if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
                    this.dragDirection = 'row';
                    const y = this.dragStartY;
                    
                    // Store initial positions and grid coordinates
                    for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                        const sprite = this.gemsSprites[x][y];
                        this.draggingSprites.push(sprite);
                        // Store both the initial position and grid coordinate
                        this.dragStartPositions.push({
                            x: sprite.x,
                            gridX: x
                        });
                    }
                } else if (Math.abs(deltaY) > 5) {
                    this.dragDirection = 'col';
                    const x = this.dragStartX;
                    
                    for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                        const sprite = this.gemsSprites[x][y];
                        this.draggingSprites.push(sprite);
                        this.dragStartPositions.push({
                            y: sprite.y,
                            gridY: y
                        });
                    }
                }
            }

            if (this.dragDirection === 'row') {
                const totalWidth = this.GRID_SIZE.cols * this.GEM_SIZE;
                const newPositions = [];
                
                // Calculate total grid movement
                let rawGridOffset = deltaX / this.GEM_SIZE;
                let gridOffset = Math.abs(rawGridOffset % 1) < 0.2 ? 
                    Math.round(rawGridOffset) : 
                    Math.floor(rawGridOffset);
                
                // Calculate how many complete wraps have occurred
                let completeWraps = Math.floor(Math.abs(gridOffset) / this.GRID_SIZE.cols);
                let effectiveOffset = gridOffset % this.GRID_SIZE.cols;
                
                // Get the remainder for smooth movement
                let remainder = deltaX - (gridOffset * this.GEM_SIZE);
                
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    const startPos = this.dragStartPositions[i];
                    
                    // Calculate new grid position including wraps
                    let newGridX = startPos.gridX + effectiveOffset;
                    if (newGridX < 0) newGridX += this.GRID_SIZE.cols;
                    newGridX = newGridX % this.GRID_SIZE.cols;
                    
                    // Calculate screen position
                    let baseX = this.BOARD_OFFSET.x + (newGridX * this.GEM_SIZE) + this.GEM_SIZE / 2;
                    let newX = baseX + remainder;
                    
                    this.draggingSprites[i].x = newX;
                    newPositions.push(newX);
                }
                this.dragCurrentPositions = newPositions;

            } else if (this.dragDirection === 'col') {
                const totalHeight = this.GRID_SIZE.rows * this.GEM_SIZE;
                const newPositions = [];
                
                // Calculate total grid movement
                let rawGridOffset = deltaY / this.GEM_SIZE;
                let gridOffset = Math.abs(rawGridOffset % 1) < 0.2 ? 
                    Math.round(rawGridOffset) : 
                    Math.floor(rawGridOffset);
                
                // Calculate how many complete wraps have occurred
                let completeWraps = Math.floor(Math.abs(gridOffset) / this.GRID_SIZE.rows);
                let effectiveOffset = gridOffset % this.GRID_SIZE.rows;
                
                // Get the remainder for smooth movement
                let remainder = deltaY - (gridOffset * this.GEM_SIZE);
                
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    const startPos = this.dragStartPositions[i];
                    
                    // Calculate new grid position including wraps
                    let newGridY = startPos.gridY + effectiveOffset;
                    if (newGridY < 0) newGridY += this.GRID_SIZE.rows;
                    newGridY = newGridY % this.GRID_SIZE.rows;
                    
                    // Calculate screen position
                    let baseY = this.BOARD_OFFSET.y + (newGridY * this.GEM_SIZE) + this.GEM_SIZE / 2;
                    let newY = baseY + remainder;
                    
                    this.draggingSprites[i].y = newY;
                    newPositions.push(newY);
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

            if (this.dragDirection === 'row') {
                const amount = Math.round(deltaX / this.GEM_SIZE);
                if (amount !== 0) {
                    moveAction = new MoveAction('row', this.dragStartY, amount);
                }
            } else if (this.dragDirection === 'col') {
                const amount = Math.round(deltaY / this.GEM_SIZE);
                if (amount !== 0) {
                    moveAction = new MoveAction('col', this.dragStartX, -amount); // Negative because of coordinate system
                }
            }

            if (moveAction) {
                this.canMove = false;
                this.applyMove(moveAction);
            } else {
                // No move, snap back to original positions
                this.snapBack();
            }

            this.isDragging = false;
            this.dragDirection = null;
            this.draggingSprites = [];
            this.dragStartPositions = [];
            this.dragCurrentPositions = [];
        }
    }

    applyMove(moveAction) {
        // Apply the move to the backend puzzle
        const explodeAndReplacePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([moveAction]);

        // **Corrected Order:** Update frontend *after* backend processing
        this.time.delayedCall(300, () => {
            if (!explodeAndReplacePhase.isNothingToDo()) {
                this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements);
            } else {
                this.canMove = true;
                this.updateGemsFromPuzzleState(); // Synchronize frontend after move (no matches)
            }
        });
    }


    updateGemsFromPuzzleState() {
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                const gemData = this.backendPuzzle.puzzleState[x][y];
                let sprite = this.gemsSprites[x][y];

                if (sprite) {
                    // Update the sprite's texture if the gem type has changed
                    if (sprite.getData('gemType') !== gemData.gemType) {
                        sprite.setTexture(`${gemData.gemType}_gem_${0}`);
                        sprite.setData('gemType', gemData.gemType);
                    }

                    // Update position
                    const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                    const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                    sprite.gridX = x;
                    sprite.gridY = y;

                    if (sprite.x !== xPos || sprite.y !== yPos) {
                        this.tweens.add({
                            targets: sprite,
                            x: xPos,
                            y: yPos,
                            duration: 200,
                            ease: 'Quad.easeOut'
                        });
                    }
                } else if (gemData) {
                    // Create a new sprite if one doesn't exist and there's a gem in puzzleState
                    const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                    const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                    sprite = this.add.sprite(xPos, yPos, `${gemData.gemType}_gem_${0}`);
                    sprite.setInteractive();
                    this.input.setDraggable(sprite);
                    sprite.gridX = x;
                    sprite.gridY = y;
                    sprite.setData('gemType', gemData.gemType);
                    this.gemsSprites[x][y] = sprite;
                }
            }
        }
    }

    snapBack() {
        // Tween the dragging sprites back to their original positions
        for (let i = 0; i < this.draggingSprites.length; i++) {
            const sprite = this.draggingSprites[i];
            const startPosition = this.dragCurrentPositions[i];

            if (this.dragDirection === 'row') {
                const xPos = this.dragStartPositions[i].x;
                let delta = xPos - startPosition;
                // Handle wrapping
                if (Math.abs(delta) > (this.GRID_SIZE.cols * this.GEM_SIZE) / 2) {
                    delta = delta > 0 ? delta - this.GRID_SIZE.cols * this.GEM_SIZE : delta + this.GRID_SIZE.cols * this.GEM_SIZE;
                }
                this.tweens.add({
                    targets: sprite,
                    x: xPos,
                    duration: 200,
                    ease: 'Quad.easeOut'
                });
            } else if (this.dragDirection === 'col') {
                const yPos = this.dragStartPositions[i].y;
                let delta = yPos - startPosition;
                // Handle wrapping
                if (Math.abs(delta) > (this.GRID_SIZE.rows * this.GEM_SIZE) / 2) {
                    delta = delta > 0 ? delta - this.GRID_SIZE.rows * this.GEM_SIZE : delta + this.GRID_SIZE.rows * this.GEM_SIZE;
                }
                this.tweens.add({
                    targets: sprite,
                    y: yPos,
                    duration: 200,
                    ease: 'Quad.easeOut'
                });
            }
        }
    }

    handleMatches(matches, replacements) {
        // Simple fade out for matched gems
        const promises = [];
        
        for (let match of matches) {
            for (let [x, y] of match) {
                const sprite = this.gemsSprites[x][y];
                if (sprite) {
                    const tween = this.tweens.add({
                        targets: sprite,
                        alpha: 0,
                        duration: 200,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            sprite.destroy();
                        }
                    });
                    promises.push(tween);
                    this.gemsSprites[x][y] = null;
                }
            }
        }

        // Wait for all fade outs to complete
        this.tweens.add({
            targets: {},
            duration: 250,
            onComplete: () => {
                this.makeGemsFall(replacements);
            }
        });
    }

    makeGemsFall(replacements) {
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            const columnSprites = this.gemsSprites[x];
            let newColumnSprites = columnSprites.filter(sprite => sprite !== null);

            const replacementsForCol = replacements.find(r => r[0] === x);
            if (replacementsForCol) {
                const gemTypes = replacementsForCol[1];
                for (let i = 0; i < gemTypes.length; i++) {
                    const gemType = gemTypes[i];
                    const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                    const yPos = this.BOARD_OFFSET.y - ((i + 1) * this.GEM_SIZE);
                    const sprite = this.add.sprite(xPos, yPos, `${gemType}_gem_${0}`);
                    sprite.setInteractive();
                    sprite.gridX = x;
                    sprite.gridY = -(gemTypes.length - i);
                    sprite.setData('gemType', gemType);
                    newColumnSprites.unshift(sprite);
                }
            }

            // Update gridY and create fall tweens
            for (let y = 0; y < newColumnSprites.length; y++) {
                const sprite = newColumnSprites[y];
                sprite.gridY = y;
                const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                
                const fallDistance = Math.abs(sprite.y - yPos);
                const duration = Math.min(200 + (fallDistance / this.GEM_SIZE * 30), 400);
                
                this.tweens.add({
                    targets: sprite,
                    x: xPos,
                    y: yPos,
                    duration: duration,
                    ease: 'Quad.easeIn'
                });
            }

            this.gemsSprites[x] = newColumnSprites;
        }

        // Wait for all falls to complete
        this.tweens.add({
            targets: {},
            duration: 450,
            onComplete: () => {
                const explodeAndReplacePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([]);
                if (!explodeAndReplacePhase.isNothingToDo()) {
                    this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements);
                } else {
                    this.canMove = true;
                    this.updateGemsFromPuzzleState();
                }
            }
        });
    }
}