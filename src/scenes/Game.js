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
        
        // Update all gem positions
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                const sprite = this.gemsSprites[x][y];
                if (sprite) {
                    const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                    const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                    sprite.setPosition(xPos, yPos);
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

                const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;

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
                            gridX: x
                        });
                    }
                } else if (Math.abs(deltaY) > dragThreshold) {
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
                
                let rawGridOffset = deltaX / this.GEM_SIZE;
                let gridOffset = Math.abs(rawGridOffset % 1) < 0.2 ? 
                    Math.round(rawGridOffset) : 
                    Math.floor(rawGridOffset);
                
                let completeWraps = Math.floor(Math.abs(gridOffset) / this.GRID_SIZE.cols);
                let effectiveOffset = gridOffset % this.GRID_SIZE.cols;
                
                let remainder = deltaX - (gridOffset * this.GEM_SIZE);
                
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    const startPos = this.dragStartPositions[i];
                    
                    let newGridX = startPos.gridX + effectiveOffset;
                    if (newGridX < 0) newGridX += this.GRID_SIZE.cols;
                    newGridX = newGridX % this.GRID_SIZE.cols;
                    
                    let baseX = this.BOARD_OFFSET.x + (newGridX * this.GEM_SIZE) + this.GEM_SIZE / 2;
                    let newX = baseX + remainder;
                    
                    this.draggingSprites[i].x = newX;
                    newPositions.push(newX);
                }
                this.dragCurrentPositions = newPositions;

            } else if (this.dragDirection === 'col') {
                const totalHeight = this.GRID_SIZE.rows * this.GEM_SIZE;
                const newPositions = [];
                
                let rawGridOffset = deltaY / this.GEM_SIZE;
                let gridOffset = Math.abs(rawGridOffset % 1) < 0.2 ? 
                    Math.round(rawGridOffset) : 
                    Math.floor(rawGridOffset);
                
                let completeWraps = Math.floor(Math.abs(gridOffset) / this.GRID_SIZE.rows);
                let effectiveOffset = gridOffset % this.GRID_SIZE.rows;
                
                let remainder = deltaY - (gridOffset * this.GEM_SIZE);
                
                for (let i = 0; i < this.draggingSprites.length; i++) {
                    const startPos = this.dragStartPositions[i];
                    
                    let newGridY = startPos.gridY + effectiveOffset;
                    if (newGridY < 0) newGridY += this.GRID_SIZE.rows;
                    newGridY = newGridY % this.GRID_SIZE.rows;
                    
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
                    moveAction = new MoveAction('col', this.dragStartX, -amount);
                }
            }

            if (moveAction) {
                this.canMove = false;
                this.applyMove(moveAction);
            } else {
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
        const explodeAndReplacePhase = this.backendPuzzle.getNextExplodeAndReplacePhase([moveAction]);

        this.time.delayedCall(300, () => {
            if (!explodeAndReplacePhase.isNothingToDo()) {
                this.handleMatches(explodeAndReplacePhase.matches, explodeAndReplacePhase.replacements);
            } else {
                this.canMove = true;
                this.updateGemsFromPuzzleState();
            }
        });
    }

    updateGemsFromPuzzleState() {
        for (let x = 0; x < this.GRID_SIZE.cols; x++) {
            for (let y = 0; y < this.GRID_SIZE.rows; y++) {
                const gemData = this.backendPuzzle.puzzleState[x][y];
                let sprite = this.gemsSprites[x][y];

                if (sprite) {
                    if (sprite.getData('gemType') !== gemData.gemType) {
                        sprite.setTexture(`${gemData.gemType}_gem_${0}`);
                        sprite.setData('gemType', gemData.gemType);
                    }

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
                    const xPos = this.BOARD_OFFSET.x + x * this.GEM_SIZE + this.GEM_SIZE / 2;
                    const yPos = this.BOARD_OFFSET.y + y * this.GEM_SIZE + this.GEM_SIZE / 2;
                    sprite = this.add.sprite(xPos, yPos, `${gemData.gemType}_gem_${0}`);
                    sprite.setInteractive();
                    this.input.setDraggable(sprite);
                    sprite.setDisplaySize(this.GEM_SIZE * 0.9, this.GEM_SIZE * 0.9);
                    sprite.gridX = x;
                    sprite.gridY = y;
                    sprite.setData('gemType', gemData.gemType);
                    this.gemsSprites[x][y] = sprite;
                }
            }
        }
    }

    snapBack() {
        for (let i = 0; i < this.draggingSprites.length; i++) {
            const sprite = this.draggingSprites[i];
            const startPosition = this.dragCurrentPositions[i];

            if (this.dragDirection === 'row') {
                const xPos = this.dragStartPositions[i].x;
                let delta = xPos - startPosition;
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
                    sprite.setDisplaySize(this.GEM_SIZE * 0.9, this.GEM_SIZE * 0.9);
                    sprite.gridX = x;
                    sprite.gridY = -(gemTypes.length - i);
                    sprite.setData('gemType', gemType);
                    newColumnSprites.unshift(sprite);
                }
            }

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