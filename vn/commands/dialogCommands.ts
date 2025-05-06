import { app } from 'db://assets/app/app';
import { ISentence, arg, commandType } from '../../../../res-native/script/webGal/parser/interface/sceneInterface';
import { ICocosPerformHandle, VnCommandError } from '../vnTypes';
import { playVocalAsync, stopVocal } from '../VnVocal';
import { MAX_TEXT_SPEED } from '../../../app-controller/VnController';

/**
 * 处理say命令
 * @param args 参数数组
 * @param sentence 完整句子对象
 * @returns ICocosPerformHandle | VnCommandError | { arrangePerformPromise: Promise<ICocosPerformHandle> }
 */
export function handleSay(args: arg[], sentence: ISentence): ICocosPerformHandle | VnCommandError | { arrangePerformPromise: Promise<ICocosPerformHandle> } {
    try {
        // 解析参数
        let text = sentence.content;
        let speaker = sentence.commandRaw;
        let vocal: string | undefined = undefined;
        let notend = false;

        app.controller.vn.showUI();
        
        // 查找文本, 说话者, vocal 和 notend 参数
        for (const arg of args) {
            if (arg.key === 'text') {
                text = String(arg.value);
            } else if (arg.key === 'speaker') {
                speaker = String(arg.value);
            } else if (arg.key === 'notend' && arg.value === true) {
                notend = true;
            } else if (arg.value == true) { // vocal 特殊处理
                vocal = String(arg.key); // vocal的值为对应的音频资源的路径
            }
        }
        
        // 如果没有找到text参数，使用sentence.content
        if (!text && sentence.content) {
            text = sentence.content;
        }
        
        // 更新对话状态 (Initial update, full text will be set by VnController for typing effect)
        app.store.vn.setDialog(""); // Clear previous text, set speaker
        app.store.vn.setDialogFullText(text);
        app.store.vn.setSpeaker(speaker);
        // We need to store the full text somewhere for VnController to use for typing
        // Adding full text and notend to customData
        const customData = { fullText: text, speaker, notend };

        // Generate a unique performName (or use a fixed one for say)
        const performName = 'say'; // Use a fixed name for say command perform

        if (vocal) {
            // If vocal is present, return a handle with arrangePerformPromise
            // Replace playVocal(sentence) with VnVocal.playVocalAsync
            // The promise from playVocalAsync resolves with vocal playback info { stop, duration }.
            // We need to combine this with text-specific handle logic.
            // The arrangePerformPromise should resolve with the FINAL combined handle.
            return {
                 arrangePerformPromise: playVocalAsync(vocal, 100).then((vocalPlaybackInfo: { stop: () => void, duration: number }) => {
                    // Calculate text duration based on text length and typing speed
                    // Get text speed from app.store.setting.vnConfig.textSpeed
                    const textSpeed = app.store.setting.vnConfig.textSpeed * MAX_TEXT_SPEED; // characters per second
                    const textDuration = (text.length / textSpeed) * 1000; // duration in ms

                     // Combine vocal handle and text logic into a new handle
                    const combinedHandle: ICocosPerformHandle = {
                        performName: performName, // Use 'say' performName
                        duration: Math.max(vocalPlaybackInfo.duration, textDuration), // Duration is max of vocal and text typing
                        goNextWhenOver: notend || (vocalPlaybackInfo.duration > 0), // Go next if notend or vocal has duration
                        isHoldOn: false, // Not a hold-on perform
                        blockingAuto: () => vocalPlaybackInfo.duration > 0, // Block auto if vocal has duration
                        blockingNext: () => false, // Don't block manual next
                        stopFunction: () => { // Combined stop function
                             // Stop vocal playback
                             stopVocal(vocal);
                             // Trigger text typing immediate completion
                             app.controller.vn.settleTyping();
                         },
                         customData: { ...customData } // Include full text, speaker, notend
                    };
                    
                    return combinedHandle;
                 })
            };

        } else {
            // If no vocal, return a direct handle for text typing
            // Calculate text duration based on text length and typing speed
            // Get text speed from app.store.setting.vnConfig.textSpeed
            const textSpeed = app.store.setting.vnConfig.textSpeed * MAX_TEXT_SPEED; // characters per second
            const textDuration = (text.length / textSpeed) * 1000; // duration in ms

            return {
                performName: performName,
                duration: textDuration, // Duration is text typing duration
                goNextWhenOver: notend, // Go next if notend
                isHoldOn: false,
                blockingAuto: () => true, // Block auto during text typing
                blockingNext: () => false, // Don't block manual next
                stopFunction: () => { // Text typing stop function
                    app.controller.vn.settleTyping();
                },
                customData: customData // Include full text, speaker, notend
            };
        }

    } catch (e) {
        return {
            isError: true,
            message: `执行say命令失败: ${e instanceof Error ? e.message : String(e)}`,
            command: commandType.say,
            details: e
        };
    }
} 