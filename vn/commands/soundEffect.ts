import { ISentence, arg, commandType } from '../../../../res-native/script/webGal/parser/interface/sceneInterface';
import { ICocosPerformHandle, VnCommandError } from '../vnTypes';
import { app } from "db://assets/app/app";
import { AudioClip } from 'cc';

export const handleSoundEffectCommand = (args: any[], sentence: ISentence): ICocosPerformHandle | { arrangePerformPromise: Promise<ICocosPerformHandle> } | VnCommandError => {
    let effectPath: string | undefined = sentence.content;
    let volume = 100; // Default volume

    // Parse arguments
    for (const e of sentence.args) {
        switch (e.key) {
            case 'volume':
                volume = Number(e.value);
                if (isNaN(volume) || volume < 0 || volume > 100) {
                    return {
                        isError: true,
                        message: `Invalid volume parameter: ${e.value}. Must be between 0 and 100.`,
                        command: sentence.command
                    };
                }
                break;
            default:
                // Ignore other arguments
                break;
        }
    }

    if (!effectPath) {
         return { 
            isError: true, 
            message: `Missing effect sound path.`, 
            command: sentence.command 
        };
    }

    const bundleName = app.manager.vn.curNovelBundleName;
    // Assuming global effect volume is 0-1 based on store.setting.ts and bgm.ts reference
    // Need to confirm the actual path for effect volume setting, using bgmVolume as a placeholder
    // TODO: Confirm global effect volume setting path.
    const globalVolume = app.store.setting.vnConfig.bgmVolume; // Placeholder

    let fullEffectPath = effectPath; // Use path directly
    // Remove .mp3 extension if present, based on bgm.ts logic
    if (fullEffectPath.endsWith(".mp3")) {
        fullEffectPath = fullEffectPath.substring(0, fullEffectPath.length - 4);
    }

    const arrangePerformPromise = new Promise<ICocosPerformHandle>(async (resolve, reject) => { 
        // Load the audio clip to get duration and prepare for playback
        app.manager.loader.load({
            bundle: bundleName,
            path: fullEffectPath,
            type: AudioClip,
            onComplete: async (item: AudioClip | null) => { // Made onComplete async
                if (!item) {
                    console.error(`Failed to load effect audio clip for path: ${fullEffectPath}`);
                    // Reject the promise with an error object
                    reject({ 
                        isError: true, 
                        message: `Failed to load effect audio clip for path: ${effectPath}.`, 
                        command: sentence.command 
                    } as VnCommandError); 
                    return;
                }

                const duration = item.getDuration() * 1000; // duration is in seconds, convert to ms

                // Combine command volume (0-100) and global setting (0-1)
                const finalVolume = (volume / 100) * globalVolume; 

                try {
                     // Play the audio effect using SoundManager
                    const audioId = await app.manager.sound.playEffectAsync({ bundle: bundleName, name: fullEffectPath, volume: finalVolume });

                    // Create the stop function
                    const stopFunction = () => {
                        app.manager.sound.stopEffect(audioId);
                        console.log(`Stopped effect audio with ID: ${audioId} for path: ${effectPath}`);
                    };

                    console.log(`[playEffect Command] 播放音效: ${effectPath}, 音量: ${finalVolume}`);

                    // Resolve with the perform handle
                    resolve({
                        performName: "soundEffect",
                        duration: duration,
                        goNextWhenOver: true, 
                        isHoldOn: false,
                        blockingAuto: () => false,
                        blockingNext: () => false,
                        skipNextCollect: false, 
                        stopFunction: stopFunction,
                    });
                } catch (error: any) { 
                    console.error(`Error playing effect audio clip for path: ${effectPath}`, error);
                    // Reject the promise with an error object
                     reject({ 
                        isError: true, 
                        message: `Error playing effect audio clip for path: ${effectPath}. Details: ${error.message}`, 
                        command: sentence.command,
                        details: error
                    } as VnCommandError); 
                }
            }
        });
    });

    return { arrangePerformPromise };
}; 