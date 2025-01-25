import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-container',
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH,
        autoRound: true,
        orientation: Phaser.Scale.PORTRAIT
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    input: {
        activePointers: 2,
        touch: {
            capture: true,
            dragThreshold: 5
        }
    },
    render: {
        antialias: false,
        pixelArt: false,
        roundPixels: true
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        Game,
        GameOver
    ]
};

export default new Phaser.Game(config);
