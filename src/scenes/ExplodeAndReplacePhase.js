// ExplodeAndReplacePhase.js
export class ExplodeAndReplacePhase {
    constructor(matches, replacements) {
        this.matches = matches; // Array of matches, each match is an array of [x, y]
        this.replacements = replacements; // Array of [x, [gemTypes]]
    }

    isNothingToDo() {
        return this.matches.length === 0;
    }
}
