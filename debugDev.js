(function() {
    'use strict';

    // =========================================================================
    // 1. CORE ENGINE DEV STORAGE STATE
    // =========================================================================
    const DevEngineState = {
        flags: {
            godModePlayer1: false,
            godModePlayer2: false,
            oneHitKillActive: false,
            infiniteSpecialPower: false,
            opponentMovementFreeze: false,
            hitboxVisualizerActive: false,
            autoPilotP1: false,
            slowMotionActive: false
        },
        metrics: {
            totalFramesProcessed: 0,
            lastFrameTimestamp: performance.now(),
            currentCalculatedFps: 60,
            averageFrameTimeMs: 16.67
        },
        config: {
            defaultSpawnVelocityY: 3.5,
            defaultItemRadius: 15,
            defaultItemWidth: 30,
            defaultItemHeight: 30,
            boundaryPadding: 60
        }
    };

    // =========================================================================
    // 2. ADVANCED MATHEMATICAL & UTILITY HELPERS
    // =========================================================================
    function calculateVectorDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function clampValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function generateRandomXCoordinate() {
        const screenWidth = window.innerWidth || 800;
        return Math.random() * (screenWidth - (DevEngineState.config.boundaryPadding * 2)) + DevEngineState.config.boundaryPadding;
    }

    function safeQueryElement(selector) {
        try {
            return document.querySelector(selector);
        } catch (e) {
            return null;
        }
    }

    function forceSyncGameUserInterface() {
        if (typeof window.updateHUD === 'function') {
            window.updateHUD();
        }
        const htmlTimer = safeQueryElement('#timer');
        if (htmlTimer && window.GS && typeof window.GS.timer !== 'undefined') {
            htmlTimer.textContent = window.GS.timer;
        }
    }

    // =========================================================================
    // 3. CORE REAL-TIME MANIPULATION LOOP (HOOKED INTO ANIMATION FRAME)
    // =========================================================================
    function executeRuntimeHackPipeline() {
        // Track frame times and performance signatures
        DevEngineState.metrics.totalFramesProcessed++;
        const currentNow = performance.now();
        const loopDeltaTime = currentNow - DevEngineState.metrics.lastFrameTimestamp;
        
        if (loopDeltaTime >= 1000) {
            DevEngineState.metrics.currentCalculatedFps = Math.round((DevEngineState.metrics.totalFramesProcessed * 1000) / loopDeltaTime);
            DevEngineState.metrics.averageFrameTimeMs = loopDeltaTime / DevEngineState.metrics.totalFramesProcessed;
            DevEngineState.metrics.totalFramesProcessed = 0;
            DevEngineState.metrics.lastFrameTimestamp = currentNow;
        }

        // Global State Validation and Multi-Feature Injection Pipeline
        if (window.GS) {
            
            // Feature A: Invincibility Arrays Override for Player 1
            if (DevEngineState.flags.godModePlayer1 && window.GS.p1) {
                if (typeof window.GS.p1.hp !== 'undefined') {
                    window.GS.p1.hp = 100;
                }
                if (typeof window.GS.p1.shield !== 'undefined') {
                    window.GS.p1.shield = 100;
                }
            }

            // Feature B: Invincibility Arrays Override for Player 2
            if (DevEngineState.flags.godModePlayer2 && window.GS.p2) {
                if (typeof window.GS.p2.hp !== 'undefined') {
                    window.GS.p2.hp = 100;
                }
                if (typeof window.GS.p2.shield !== 'undefined') {
                    window.GS.p2.shield = 100;
                }
            }

            // Feature C: One-Hit Kill Target Interception Matrix
            if (DevEngineState.flags.oneHitKillActive && window.GS.p2) {
                if (typeof window.GS.p2.hp !== 'undefined' && window.GS.p2.hp > 1) {
                    window.GS.p2.hp = 1;
                }
            }

            // Feature D: Continuous Special Charge Accumulator
            if (DevEngineState.flags.infiniteSpecialPower) {
                if (window.GS.p1 && typeof window.GS.p1.spCharge !== 'undefined') {
                    window.GS.p1.spCharge = 100;
                }
                if (window.GS.p2 && typeof window.GS.p2.spCharge !== 'undefined') {
                    window.GS.p2.spCharge = 100;
                }
                if (window.GS.p1 && typeof window.GS.p1.energy !== 'undefined') {
                    window.GS.p1.energy = 100;
                }
            }

            // Feature E: Rigid Position & Velocity Locking for Opponent
            if (DevEngineState.flags.opponentMovementFreeze && window.GS.p2) {
                if (typeof window.GS.p2.vx !== 'undefined') window.GS.p2.vx = 0;
                if (typeof window.GS.p2.vy !== 'undefined') window.GS.p2.vy = 0;
                if (typeof window.GS.p2.speed !== 'undefined') window.GS.p2.speed = 0;
            }

            // Feature F: Experimental Autopilot Routine (P1 follows ball tracking vectors)
            if (DevEngineState.flags.autoPilotP1 && window.GS.p1 && window.GS.ball) {
                const targetDeltaX = window.GS.ball.x - window.GS.p1.x;
                if (Math.abs(targetDeltaX) > 10) {
                    window.GS.p1.vx = targetDeltaX > 0 ? 5 : -5;
                }
            }

            // Automatic UI Synchronization
            forceSyncGameUserInterface();
        }

        // Maintain continuous invocation binding to monitor frames
        requestAnimationFrame(executeRuntimeHackPipeline);
    }
    
    // Fire up the monolithic loop sequence instantly
    requestAnimationFrame(executeRuntimeHackPipeline);

    // =========================================================================
    // 4. HARDWARE KEYBOARD EVENT CAPTURE LAYER (HOTKEYS)
    // =========================================================================
    function handleHardwareKeyboardTrigger(event) {
        if (!window.GS) return;

        const incomingKey = event.key.toLowerCase();

        if (incomingKey === '1') {
            DevEngineState.flags.godModePlayer1 = !DevEngineState.flags.godModePlayer1;
        } 
        else if (incomingKey === '2') {
            DevEngineState.flags.godModePlayer2 = !DevEngineState.flags.godModePlayer2;
        } 
        else if (incomingKey === '3') {
            DevEngineState.flags.oneHitKillActive = !DevEngineState.flags.oneHitKillActive;
        } 
        else if (incomingKey === '4') {
            DevEngineState.flags.infiniteSpecialPower = !DevEngineState.flags.infiniteSpecialPower;
        } 
        else if (incomingKey === '5') {
            DevEngineState.flags.opponentMovementFreeze = !DevEngineState.flags.opponentMovementFreeze;
        } 
        else if (incomingKey === '6') {
            const registeredItemsList = ['lightning', 'heart', 'bigheart', 'bomb', 'sticky', 'star', 'flame', 'ice', 'arrow'];
            const computationIndex = Math.floor(Math.random() * registeredItemsList.length);
            const resolvedItemType = registeredItemsList[computationIndex];
            window.dfSpawnItem(resolvedItemType);
        } 
        else if (incomingKey === '7') {
            window.dfInstantWin();
        } 
        else if (incomingKey === '8') {
            window.dfSetTimer(99);
        }
        else if (incomingKey === '9') {
            DevEngineState.flags.autoPilotP1 = !DevEngineState.flags.autoPilotP1;
        }
    }

    window.addEventListener('keydown', handleHardwareKeyboardTrigger);

    // =========================================================================
    // 5. GLOBAL CONTROL API EXPOSURE WINDOW INTERFACE
    // =========================================================================
    window.dfGodP1 = function() {
        DevEngineState.flags.godModePlayer1 = !DevEngineState.flags.godModePlayer1;
        return DevEngineState.flags.godModePlayer1;
    };

    window.dfGodP2 = function() {
        DevEngineState.flags.godModePlayer2 = !DevEngineState.flags.godModePlayer2;
        return DevEngineState.flags.godModePlayer2;
    };

    window.dfOneHitKill = function() {
        DevEngineState.flags.oneHitKillActive = !DevEngineState.flags.oneHitKillActive;
        return DevEngineState.flags.oneHitKillActive;
    };

    window.dfInfiniteSpecial = function() {
        DevEngineState.flags.infiniteSpecialPower = !DevEngineState.flags.infiniteSpecialPower;
        return DevEngineState.flags.infiniteSpecialPower;
    };

    window.dfFreezeOpponent = function() {
        DevEngineState.flags.opponentMovementFreeze = !DevEngineState.flags.opponentMovementFreeze;
        return DevEngineState.flags.opponentMovementFreeze;
    };

    window.dfSetHP = function(playerIdentifier, targetNumericValue) {
        if (!window.GS) return false;
        
        const safeTargetValue = clampValue(targetNumericValue, 0, 100);
        
        if (playerIdentifier === 1 && window.GS.p1) {
            window.GS.p1.hp = safeTargetValue;
            forceSyncGameUserInterface();
            return true;
        } else if (playerIdentifier === 2 && window.GS.p2) {
            window.GS.p2.hp = safeTargetValue;
            forceSyncGameUserInterface();
            return true;
        }
        return false;
    };

    window.dfSetTimer = function(targetSecondsValue) {
        if (!window.GS) return false;
        
        const validatedTimeValue = Math.max(0, parseInt(targetSecondsValue, 10) || 0);
        window.GS.timer = validatedTimeValue;
        
        forceSyncGameUserInterface();
        return true;
    };

    window.dfSpawnItem = function(targetExplicitType) {
        if (!window.GS || !window.GS.items || !Array.isArray(window.GS.items)) {
            return false;
        }

        const fallbackItemType = 'lightning';
        const finalizedItemTypeString = targetExplicitType || fallbackItemType;
        const dynamicallyCalculatedX = generateRandomXCoordinate();

        const entityStructurePacket = {
            type: finalizedItemTypeString,
            x: dynamicallyCalculatedX,
            y: DevEngineState.config.boundaryPadding,
            vy: DevEngineState.config.defaultSpawnVelocityY,
            r: DevEngineState.config.defaultItemRadius,
            w: DevEngineState.config.defaultItemWidth,
            h: DevEngineState.config.defaultItemHeight,
            pulse: 0,
            creationTimestamp: performance.now()
        };

        window.GS.items.push(entityStructurePacket);
        return true;
    };

    window.dfInstantWin = function() {
        if (window.GS && window.GS.p2) {
            window.GS.p2.hp = 0;
            forceSyncGameUserInterface();
            return true;
        }
        return false;
    };

    // Global Registry Object Mapping for external inspection utilities
    window.DarkFoxDevCore = {
        stateStorage: DevEngineState,
        triggerInterface: handleHardwareKeyboardTrigger,
        pipelineLoop: executeRuntimeHackPipeline
    };

})();
