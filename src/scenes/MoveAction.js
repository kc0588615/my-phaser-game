// MoveAction.js
export class MoveAction {
    constructor(rowOrCol, index, amount) {
        this.rowOrCol = rowOrCol; // 'row' or 'col'
        this.index = index;
        this.amount = amount;
    }
}
