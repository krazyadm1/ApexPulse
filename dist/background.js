/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/*!**************************************!*\
  !*** ./src/background/background.ts ***!
  \**************************************/

/**
 * ApexPulse Background Controller
 */
class BackgroundController {
    constructor() {
        this.init();
    }
    async init() {
        console.log('ApexPulse background initialized');
        // Listen for game events
        overwolf.games.events.onInfoUpdates2.addListener((info) => {
            console.log('Game Info Update:', info);
        });
        overwolf.games.events.onNewEvents.addListener((events) => {
            console.log('New Game Events:', events);
        });
        // Register for Apex Legends (ID: 21566)
        this.setFeatures();
    }
    setFeatures() {
        const features = [
            'gep_internal', 'me', 'team', 'kill', 'damage', 'death',
            'revive', 'match_state', 'game_info', 'match_info',
            'inventory', 'location', 'match_summary', 'roster',
            'rank', 'kill_feed'
        ];
        overwolf.games.events.setRequiredFeatures(features, (info) => {
            if (info.success) {
                console.log('Successfully set features for Apex Legends');
            }
            else {
                console.error('Failed to set features:', info.error);
            }
        });
    }
}
new BackgroundController();

/******/ })()
;
//# sourceMappingURL=background.js.map