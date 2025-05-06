import { app } from '../../../app/app';
import { AudioClip } from 'cc'; // Import AudioClip for typing

/**
 * VN Vocal 处理模块，封装 SoundManager 功能以提供 Vocal 播放和控制接口。
 */

// Internal map to track active vocal plays by path or audioId
// Mapping: path -> { audioId: number, stop: () => void }
const activeVocals = new Map<string | number, { audioId: number, stop: () => void }>();

/**
 * 异步播放语音。
 * @param path 语音资源路径。
 * @param volume 音量 (0-100)。
 * @returns Promise，解析后包含停止函数和时长。
 */
export const playVocalAsync = async (path: string, volume: number): Promise<{ stop: () => void, duration: number }> => {
    // Stop any existing vocal with the same path before playing a new one
    if (activeVocals.has(path)) {
        stopVocal(path);
    }

    try {
        // 1. Load the audio clip to get duration (extracted from old VocalHandler)
        const bundleName = app.manager.vn.curNovelBundleName; // Assuming VnManager has current bundle name
        const vocalPath = path; // Use the provided path

        const audioClip = await new Promise<AudioClip | null>((resolve, reject) => {
            app.manager.loader.load({
                bundle: bundleName,
                path: vocalPath,
                type: AudioClip,
                onComplete: (item: AudioClip | null) => {
                    resolve(item);
                },
                // TODO: Add onError handling if LoadManager supports it
                // onError: (error) => { reject(error); }
            });
        });

        if (!audioClip) {
            console.error(`Failed to load vocal audio clip for path: ${path}`);
            // Return a handle indicating failure
            return { stop: () => {}, duration: 0 };
        }

        const duration = audioClip.getDuration() * 1000; // duration is in seconds, convert to ms

        // 2. Play the audio effect using SoundManager
        // Note: SoundManager volume is typically 0-1, convert from 0-100
        const soundVolume = volume / 100;
        const audioId = await app.manager.sound.playEffectAsync({ bundle: bundleName, name: vocalPath, volume: soundVolume });

        // Create the stop function
        const stopFunction = () => {
            app.manager.sound.stopEffect(audioId);
            console.log(`Stopped vocal audio with ID: ${audioId} for path: ${path}`);
            // Remove from tracking map when stopped
            activeVocals.delete(path);
            activeVocals.delete(audioId); // Also remove by ID
        };

        // Track the active vocal by both path and audioId
        activeVocals.set(path, { audioId, stop: stopFunction });
        activeVocals.set(audioId, { audioId, stop: stopFunction });

        console.log(`Started playing vocal audio with ID: ${audioId} for path: ${path}, Duration: ${duration}ms`);

        // Return containing stop function and duration
        return { stop: stopFunction, duration: duration };

    } catch (error) {
        console.error(`Failed to play vocal audio for path: ${path}`, error);
        // Handle errors during loading or playback
        return { stop: () => {}, duration: 0 };
    }
};

/**
 * Query if a specific vocal audio instance is currently playing.
 * @param pathOrHandle Vocal resource path or SoundManager returned handle/ID.
 * @returns boolean, true if playing, false otherwise.
 */
export const isVocalPlaying = (pathOrHandle: string | any): boolean => {
    // Check if the vocal is in the activeVocals map
    return activeVocals.has(pathOrHandle);
};

/**
 * Stop a specific vocal audio instance.
 * @param pathOrHandle Vocal resource path or SoundManager returned handle/ID.
 */
export const stopVocal = (pathOrHandle: string | any): void => {
    // Find the vocal in the tracking map
    const vocal = activeVocals.get(pathOrHandle);
    if (vocal) {
        // Call the stored stop function
        vocal.stop();
        // The stopFunction itself removes the entry from the map
    } else {
        console.warn(`Attempted to stop vocal that is not tracked as active: ${pathOrHandle}`);
    }
}; 