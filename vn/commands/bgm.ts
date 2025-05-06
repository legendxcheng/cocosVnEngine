import { ISentence, arg, commandType } from '../../../../res-native/script/webGal/parser/interface/sceneInterface';
import { ICocosPerformHandle, VnCommandError, WEBGAL_NONE } from '../vnTypes';
import { app } from "db://assets/app/app";

export const handleBgmCommand = (args: any[], sentence: ISentence): ICocosPerformHandle | VnCommandError => {
    let bgmPath: string | undefined = sentence.content;
    let volume = 100; // Default volume
    let enterDuration = 0; // Not directly used in SoundManager.playMusic based on doc

    // Parse arguments
    for (const e of sentence.args) {
        switch (e.key) {
            case 'volume':
                volume = Number(e.value); // Expect number
                if (isNaN(volume) || volume < 0 || volume > 100) {
                    return {
                        isError: true,
                        message: `Invalid volume parameter: ${e.value}. Must be between 0 and 100.`,
                        command: sentence.command
                    };
                }
                break;
            case 'enter':
                enterDuration = Number(e.value); // Expect number (ms), will be logged but not directly used in playMusic/stopMusic
                 if (isNaN(enterDuration) || enterDuration < 0) {
                    return {
                        isError: true,
                        message: `Invalid enter parameter: ${e.value}. Must be a non-negative number.`,
                        command: sentence.command
                    };
                }
                break;
            case 'none':
                if (e.value === true) {
                    bgmPath = undefined; // Indicate stop BGM
                }
                break;
            default:
                // Ignore other arguments
                break;
        }
    }

    const bundleName = app.manager.vn.curNovelBundleName;
    // Assuming global volume is 0-1 based on store.setting.ts
    const globalVolume = app.store.setting.vnConfig.bgmVolume;

    if (bgmPath === undefined) {
        // Handle stop BGM
        app.manager.sound.stopMusic(); // stopMusic does not take arguments for fade out
        app.store.vn.setCurrentBgm(null);
        console.log(`[BGM Command] 停止BGM, (淡出时间 ${enterDuration}ms 参数被忽略，SoundManager不支持)`);
    } else {
        // Handle play new BGM
        // Stop current BGM immediately before playing new one
        app.manager.sound.stopMusic(); 

        let fullBgmPath = `${bgmPath}`;
        if (bgmPath.endsWith(".mp3")) {
            fullBgmPath = fullBgmPath.substring(0, fullBgmPath.length - 4);
        }
        // Combine command volume (0-100) and global setting (0-1)
        const finalVolume = (volume / 100) * globalVolume; 

         app.manager.sound.playMusic({
             bundle: bundleName,
             name: fullBgmPath,
             volume: finalVolume,
             // Assuming SoundManager handles loop for music
             // fadeInDuration is not supported in playMusic based on SoundManager definition
         });

        app.store.vn.setCurrentBgm(bgmPath);
        console.log(`[BGM Command] 播放BGM: ${bgmPath}, 音量: ${finalVolume}, (淡入时间 ${enterDuration}ms 参数被忽略，SoundManager不支持)`);
    }

    // Return a handle that represents the persistent BGM state
    return {
        performName: "bgm",
        duration: 0,
        goNextWhenOver: true, 
        isHoldOn: true,
        blockingAuto: () => false,
        blockingNext: () => false,
        skipNextCollect: false, 
        // No stopFunction needed as stopMusic handles cleanup
    };
}; 