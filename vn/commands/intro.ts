import { ISentence } from 'db://assets/res-native/script/webGal/parser/interface/sceneInterface';
import { ScriptHandlerFunc, ICocosPerformHandle, VnCommandError, StopHandlerFunc } from '../vnTypes';
import { app } from 'db://assets/app/app';

/**
 * intro 指令处理函数
 * @param args
 * @param sentence
 */
export const handleIntro: ScriptHandlerFunc = (args: any[], sentence: ISentence): ICocosPerformHandle | Promise<ICocosPerformHandle> | { arrangePerformPromise: Promise<ICocosPerformHandle> } | VnCommandError => {
    console.log('Executing intro command:', sentence);

    // 解析独白内容和参数
    const introContent = sentence.content;
    const lines = introContent.split('|');
    // 检查是否存在 -hold 参数，需要遍历args数组查找key为'hold'的arg
    const isHold = args.some((a: any) => a.key === 'hold'); 

    // TODO: 在 Intro 开始时候，如果 IntroNode 的 active 为 False，要设置为 True。
    // 这部分逻辑现在可以在 PageVn.ts 中监听 Store 的 introFullText 变化来实现。

    // 触发打字机效果
    if (app.controller.vn) {
        // 调用 VnController 中的通用打字机动画方法
        app.controller.vn.showIntro();
        // duration 参数目前在 Controller 中未使用，可以传 0
        app.controller.vn.triggerTypingAnimation('intro', lines, 0, (text) => {
            // 更新 Store 中用于显示的独白文本
            app.store.vn.setIntroDisplayText(text);
        });

    } else {
        console.error('app.controller.vn 未初始化，无法触发打字机动画');
        // 根据需求返回错误，或者决定跳过此命令
        // return { isError: true, message: 'VnController not initialized' };
    }

    // 构造并返回 ICocosPerformHandle
    const perform: ICocosPerformHandle = {
        performName: `intro_perform_${Date.now()}`,
        // 如果 hold 为 true，则持续无限时间，否则瞬时完成，等待打字机动画控制前进
        duration: 0, 
        // 如果 hold 为 true，不自动前进；否则，前进由打字机动画完成或用户点击控制
        // 这里依赖于 VnController 和 PageVn.ts 正确更新和监听 Store 中的 isTyping 状态
        goNextWhenOver: true, 
        isHoldOn: isHold, // 如果 hold 为 true，保持状态

        // 阻止自动前进：如果 hold 为 true 或打字机动画正在进行 (从 Store 中获取状态)
        blockingAuto: () => isHold || app.store.vn.isTyping,
        // 阻止用户点击前进：如果 hold 为 true 或打字机动画正在进行 (从 Store 中获取状态)
        blockingNext: () => isHold || app.store.vn.isTyping,
        
        // stopFunction 用于在表现结束时清理状态或隐藏节点
        stopFunction: stopIntroFunction, 
        customData: { lines, isHold }, // 将解析出的文本和 hold 状态传递给后续处理
        arrangePerformPromise: undefined, // 打字机效果通常不需要arrangePerformPromise
    };

    // TODO: 根据解析或处理过程中可能出现的错误，返回 VnCommandError
    // 例如，如果 introContent 为空且没有其他参数，可能视为错误或忽略
    // if (lines.length === 0 && args.length === 0) {
    //     return { isError: true, message: 'Intro command requires content or parameters.' };
    // }

    return perform;
};

/**
 * 可选的停止函数，用于在 intro 表现结束时进行清理
 * @param performName
 * @param customData
 */
export const stopIntroFunction: StopHandlerFunc = (performName: string, customData?: any) => {
    console.log('Stopping intro command:', performName, customData);
    // TODO: 实现清理 IntroNode 状态和 Store 状态的逻辑
    // 例如：隐藏 IntroNode，清空 Intro 文本相关的 Store 状态
    if (app.store && app.store.vn) {
        // 清空 intro 文本相关的 Store 状态
        app.store.vn.setIntroText([]); // 清空 introFullText
        app.store.vn.setIntroDisplayText(''); // 清空 introDisplayText
        app.controller.vn.hideIntro()
        // 将打字机动画状态设置为 false
        app.store.vn.setIsTyping(false);
    } else {
        console.error('app.store.vn 未初始化，无法清理 intro 状态');
    }
    // TODO: 在 PageVn.ts 中监听 stopIntroFunction 触发的清理信号或 Store 状态变化（introFullText 变空），以隐藏 IntroNode。
};

// TODO: 在 VnManager.ts 的 _registerBuiltinCommands 方法中注册 stopIntroFunction
// this.registerCommand(commandType.intro, handleIntro, stopIntroFunction); 