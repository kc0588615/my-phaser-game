// BackendPuzzle.js
import { Gem } from './gem';
import { ExplodeAndReplacePhase } from './ExplodeAndReplacePhase';

export class BackendPuzzle {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.nextGemsToSpawn = [];
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(width, height);
    }

    getInitialPuzzleStateWithNoMatches(width, height) {
        const gemTypes = ['black', 'blue', 'green', 'orange', 'red', 'white'];
        let grid = []; // grid[x][y]

        for (let x = 0; x < width; x++) {
            grid[x] = [];
            for (let y = 0; y < height; y++) {
                let possibleGems = [...gemTypes];

                if (y >= 2) {
                    if (grid[x][y - 1].gemType === grid[x][y - 2].gemType) {
                        possibleGems = possibleGems.filter(type => type !== grid[x][y - 1].gemType);
                    }
                }

                if (x >= 2) {
                    if (grid[x - 1][y].gemType === grid[x - 2][y].gemType) {
                        possibleGems = possibleGems.filter(type => type !== grid[x - 1][y].gemType);
                    }
                }

                const gemType = possibleGems[Math.floor(Math.random() * possibleGems.length)];

                grid[x][y] = new Gem(gemType);
            }
        }

        return grid;
    }

    getNextExplodeAndReplacePhase(actions) {
        // Apply actions
        for (let action of actions) {
            this.applyMoveToGrid(this.puzzleState, action);
        }

        // Get matches
        const matches = this.getMatches(this.puzzleState);

        const replacements = [];
        const counter = {};

        // Count how many gems to replace in each column
        for (const match of matches) {
            for (const coord of match) {
                const [x, y] = coord;
                counter[x] = (counter[x] || 0) + 1;
            }
        }

        for (let x = 0; x < this.width; x++) {
            const numToReplace = counter[x] || 0;
            const replacementsForCol = [];
            for (let i = 0; i < numToReplace; i++) {
                replacementsForCol.push(this.getNextGemToSpawn().gemType);
            }
            if (replacementsForCol.length > 0) {
                replacements.push([x, replacementsForCol]);
            }
        }

        // Apply the phase to the current state
        const explodeAndReplacePhase = new ExplodeAndReplacePhase(matches, replacements);
        this.applyExplodeAndReplacePhase(explodeAndReplacePhase);

        return explodeAndReplacePhase;
    }

    getMatchesFromHypotheticalMove(moveAction) {
        const hypotheticalState = JSON.parse(JSON.stringify(this.puzzleState));
        this.applyMoveToGrid(hypotheticalState, moveAction);
        return this.getMatches(hypotheticalState);
    }

    getNextGemToSpawn() {
        if (this.nextGemsToSpawn.length > 0) {
            return new Gem(this.nextGemsToSpawn.shift());
        }
        const gemTypes = ['black', 'blue', 'green', 'orange', 'red', 'white'];
        const gemType = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        return new Gem(gemType);
    }

    addNextGemToSpawn(gemType) {
        this.nextGemsToSpawn.push(gemType);
    }

    addNextGemsToSpawn(gemTypes) {
        this.nextGemsToSpawn.push(...gemTypes);
    }

    applyMoveToGrid(grid, moveAction) {
        if (moveAction.rowOrCol === 'row') {
            const width = grid.length;
            const amount = ((moveAction.amount % width) + width) % width;
            const y = moveAction.index;
            // Get the row
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push(grid[x][y]);
            }
            // Rotate the row
            const newRow = row.slice(-amount).concat(row.slice(0, -amount));
            for (let x = 0; x < width; x++) {
                grid[x][y] = newRow[x];
            }
        } else if (moveAction.rowOrCol === 'col') {
            const height = grid[0].length;
            const amount = ((moveAction.amount % height) + height) % height;
            const x = moveAction.index;
            // Rotate the column
            const col = grid[x];
            const newCol = col.slice(amount).concat(col.slice(0, amount));
            grid[x] = newCol;
        }
    }

    getMatches(puzzleState) {
        const matches = [];

        const width = puzzleState.length;
        const height = puzzleState[0].length;

        // Check vertical matches
        for (let x = 0; x < width; x++) {
            let match = [];
            let lastGemType = puzzleState[x][0].gemType;
            match.push([x, 0]);
            for (let y = 1; y < height; y++) {
                if (puzzleState[x][y].gemType === lastGemType) {
                    match.push([x, y]);
                } else {
                    if (match.length >= 3) {
                        matches.push([...match]);
                    }
                    match = [[x, y]];
                    lastGemType = puzzleState[x][y].gemType;
                }
            }
            if (match.length >= 3) {
                matches.push([...match]);
            }
        }

        // Check horizontal matches
        for (let y = 0; y < height; y++) {
            let match = [];
            let lastGemType = puzzleState[0][y].gemType;
            match.push([0, y]);
            for (let x = 1; x < width; x++) {
                if (puzzleState[x][y].gemType === lastGemType) {
                    match.push([x, y]);
                } else {
                    if (match.length >= 3) {
                        matches.push([...match]);
                    }
                    match = [[x, y]];
                    lastGemType = puzzleState[x][y].gemType;
                }
            }
            if (match.length >= 3) {
                matches.push([...match]);
            }
        }

        return matches;
    }

    applyExplodeAndReplacePhase(phase) {
        const explodeGems = new Set(phase.matches.flat().map(coord => `${coord[0]}_${coord[1]}`));
        const replacements = new Map(phase.replacements.map(([x, gems]) => [x, gems]));

        for (let x = 0; x < this.width; x++) {
            // Remove gems that are exploding
            const newColumn = [];
            for (let y = 0; y < this.height; y++) {
                if (!explodeGems.has(`${x}_${y}`)) {
                    newColumn.push(this.puzzleState[x][y]);
                }
            }
            // Add replacements at the top
            const replacementGems = (replacements.get(x) || []).map(type => new Gem(type));
            this.puzzleState[x] = replacementGems.concat(newColumn);
        }
    }

    reset() {
        this.puzzleState = this.getInitialPuzzleStateWithNoMatches(this.width, this.height);
    }
}
