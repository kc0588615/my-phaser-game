import { Scene } from 'phaser';

// scenes/Boot.js
export class Boot extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.scene.start('Preloader');
    }
}

// scenes/MainMenu.js
export class MainMenu extends Phaser.Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        this.scene.start('Game'); // For now, just go straight to game
    }
}

// scenes/GameOver.js
export class GameOver extends Phaser.Scene {
    constructor() {
        super('GameOver');
    }
}
