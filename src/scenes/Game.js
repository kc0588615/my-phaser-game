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

                // Store grid coordinates
                sprite.gridX = x;
                sprite.gridY = y;

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

                    // Prepare sprites in the row
                    const y = this.dragStartY;
                    for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                        const sprite = this.gemsSprites[x][y];
                        this.draggingSprites.push(sprite);
                        this.dragStartPositions.push(sprite.x);
                    }
                } else if (Math.abs(deltaY) > 5) {
                    this.dragDirection = 'col';

                    // Prepare sprites in the column
                    const x = this.dragStartX;
                    for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                        const sprite = this.gemsSprites[x][y];
                        this.draggingSprites.push(sprite);
                        this.dragStartPositions.push(sprite.y);
                    }
                }
            }

            if (this.dragDirection === 'row') {
                // Move the sprites horizontally based on drag
                const newPositions = [];
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    let newX = this.dragStartPositions[i] + deltaX;
                    // Handle wrapping
                    const totalWidth = this.GRID_SIZE.cols * this.GEM_SIZE;
                    if (newX < this.BOARD_OFFSET.x) {
                        newX += totalWidth;
                    } else if (newX >= this.BOARD_OFFSET.x + totalWidth) {
                        newX -= totalWidth;
                    }
                    this.draggingSprites[i].x = newX;
                    newPositions.push(newX);
                }
                this.dragCurrentPositions = newPositions;

            } else if (this.dragDirection === 'col') {
                // Move the sprites vertically based on drag
                const newPositions = [];
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    let newY = this.dragStartPositions[i] + deltaY;
                    // Handle wrapping
                    const totalHeight = this.GRID_SIZE.rows * this.GEM_SIZE;
                    if (newY < this.BOARD_OFFSET.y) {
                        newY += totalHeight;
                    } else if (newY >= this.BOARD_OFFSET.y + totalHeight) {
                        newY -= totalHeight;
                    }
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

        // Update the frontend gems accordingly
        this.updateGemsAfterMove(moveAction);

        // Handle matches
        this.time.delayedCall(300, () => {
            if (!explodeAndReplacePhase.isNothingToDo()) {
                this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements);
            } else {
                this.canMove = true;
            }
        });
    }

    updateGemsAfterMove(moveAction) {
        // Update the gemsSprites to reflect the move
        if (moveAction.rowOrCol === 'row') {
            const y = moveAction.index;
            const amount = ((moveAction.amount % this.GRID_SIZE.cols) + this.GRID_SIZE.cols) % this.GRID_SIZE.cols;
            const rowSprites = [];
            for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                rowSprites.push(this.gemsSprites[x][y]);
            }
            const newRowSprites = rowSprites.slice(-amount).concat(rowSprites.slice(0, -amount));
            for (let x = 0; x < this.GRID_SIZE.cols; x++) {
                this.gemsSprites[x][y] = newRowSprites[x];
                this.gemsSprites[x][y].gridX = x;

                // Tween to snapped position
                const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                this.tweens.add({
                    targets: this.gemsSprites[x][y],
                    x: xPos,
                    duration: 200,
                    ease: 'Quad.easeOut'
                });
            }
        } else if (moveAction.rowOrCol === 'col') {
            const x = moveAction.index;
            const amount = ((moveAction.amount % this.GRID_SIZE.rows) + this.GRID_SIZE.rows) % this.GRID_SIZE.rows;
            const colSprites = this.gemsSprites[x];
            const newColSprites = colSprites.slice(amount).concat(colSprites.slice(0, amount));
            this.gemsSprites[x] = newColSprites;
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                this.gemsSprites[x][y].gridY = y;

                // Tween to snapped position
                const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                this.tweens.add({
                    targets: this.gemsSprites[x][y],
                    y: yPos,
                    duration: 200,
                    ease: 'Quad.easeOut'
                });
            }
        }
    }

    snapBack() {
        // Tween the dragging sprites back to their original positions
        for (let i = 0; i < this.draggingSprites.length; i++) {
            const sprite = this.draggingSprites[i];
            const startPosition = this.dragCurrentPositions[i];

            if (this.dragDirection === 'row') {
                const xPos = this.dragStartPositions[i];
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
                const yPos = this.dragStartPositions[i];
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
        // Remove matched gems
        for (let match of matches) {
            for (let [x, y] of match) {
                const sprite = this.gemsSprites[x][y];
                this.tweens.add({
                    targets: sprite,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        sprite.destroy();
                    }
                });
                this.gemsSprites[x][y] = null;
            }
        }

        // After destroying matched gems, make gems fall down and add replacements
        this.time.delayedCall(200, () => {
            this.makeGemsFall(replacements);
        });
    }

    makeGemsFall(replacements) {
        // For each column, make gems fall down to fill empty spaces
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            const columnSprites = this.gemsSprites[x];

            // Remove nulls (empty spaces), shift gems down
            let newColumnSprites = columnSprites.filter(sprite => sprite !== null);

            // Calculate how many empty spaces
            const missing = this.GRID_SIZE.rows - newColumnSprites.length;

            // Add new gems at the top
            const replacementsForCol = replacements.find(r => r[0] === x);
            if (replacementsForCol) {
                const gemTypes = replacementsForCol[1];
                for (let i = 0; i < gemTypes.length; i++) {
                    const gemType = gemTypes[i];
                    const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                    const yPos = this.BOARD_OFFSET.y - (gemTypes.length - i) * this.GEM_SIZE + this.GEM_SIZE / 2;
                    const sprite = this.add.sprite(xPos, yPos, `${gemType}_gem_${0}`);
                    sprite.gridX = x;
                    sprite.gridY = - (gemTypes.length - i);
                    newColumnSprites.unshift(sprite);
                }
            }

            // Update gridY for sprites and create fall tweens
            for (let y = 0; y < newColumnSprites.length; y++) {
                const sprite = newColumnSprites[y];
                sprite.gridY = y;
                const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                this.tweens.add({
                    targets: sprite,
                    x: xPos,
                    y: yPos,
                    duration: 200
                });
            }

            this.gemsSprites[x] = newColumnSprites;
        }

        // After gems have fallen, check for new matches
        this.time.delayedCall(300, () => {
            const explodeAndReplacePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([]);
            if (!explodeAndReplacePhase.isNothingToDo()) {
                this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements);
            } else {
                this.canMove = true;
            }
        });
    }
}
