// scenes/Preloader.js
export class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        const gemTypes = ['black', 'blue', 'green', 'orange', 'red', 'white'];
        const frameCount = 8;

        // Load all gem frames for each type
        gemTypes.forEach(type => {
            for (let i = 0; i < frameCount; i++) {
                this.load.image(
                    `${type}_gem_${i}`, 
                    `assets/${type}_gem_${i}.png`
                );
            }
        });
    }

    create() {
        this.scene.start('Game');
    }
}