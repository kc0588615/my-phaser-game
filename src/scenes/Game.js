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
        this.gemsSprites = []; // 2D array [x][y] = sprite

        // Create the board
        this.createBoard();

        // Set up input handling
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);

        this.isDragging = false;
        this.canMove = true;
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
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            this.gemsSprites[x] = [];
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                const gem = this.backendPuzzle.puzzleState[x][y];
                const gemType = gem.gemType;

                const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;

                const sprite = this.add.sprite(xPos, yPos, `${gemType}_gem_${0}`);
                sprite.setInteractive();

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
        }
    }

    onPointerMove(pointer) {
        if (this.isDragging && this.canMove) {
            const deltaX = pointer.x - this.dragStartPointerX;
            const deltaY = pointer.y - this.dragStartPointerY;

            if (this.dragDirection === null) {
                if (Math.abs(deltaX) > 10) {
                    this.dragDirection = 'row';
                } else if (Math.abs(deltaY) > 10) {
                    this.dragDirection = 'col';
                }
            }

            // For visual feedback, you could shift the gems accordingly here
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
            }

            this.isDragging = false;
            this.dragDirection = null;
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
            }
        } else if (moveAction.rowOrCol === 'col') {
            const x = moveAction.index;
            const amount = ((moveAction.amount % this.GRID_SIZE.rows) + this.GRID_SIZE.rows) % this.GRID_SIZE.rows;
            const colSprites = this.gemsSprites[x];
            const newColSprites = colSprites.slice(amount).concat(colSprites.slice(0, amount));
            this.gemsSprites[x] = newColSprites;
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                this.gemsSprites[x][y].gridY = y;
            }
        }

        // Tween the sprites to their new positions
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                const sprite = this.gemsSprites[x][y];
                const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                this.tweens.add({
                    targets: sprite,
                    x: xPos,
                    y: yPos,
                    duration: 200
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
