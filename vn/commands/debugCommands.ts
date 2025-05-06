import { app } from 'db://assets/app/app';
import { ISentence, arg, commandType } from '../../../../res-native/script/webGal/parser/interface/sceneInterface';
import { ICocosPerformHandle, VnCommandError } from '../vnTypes';

/**
 * 处理 debug 命令
 * @param args 参数数组
 * @param sentence 完整句子对象
 * @returns ICocosPerformHandle | VnCommandError | { arrangePerformPromise: Promise<ICocosPerformHandle> }
 */
export function handleDebug(args: arg[], sentence: ISentence): ICocosPerformHandle | VnCommandError | { arrangePerformPromise: Promise<ICocosPerformHandle> } {
    try {
        const rawCommand = sentence.commandRaw;

        const customData = {
            speaker: "debug",
            fullText: `无法解析: ${rawCommand}-${sentence.content}`
        };

        const performName = 'debug';

        return {
            performName: performName,
            duration: 0,
            isHoldOn: true,
            blockingAuto: () => false,
            blockingNext: () => false,
            stopFunction: () => {
                // TODO: Implement settleTyping in VnController if needed for debug display
                // app.controller.vn.settleTyping();
            },
            customData: customData
        };

    } catch (e) {
        return {
            isError: true,
            message: `执行 debug 命令失败: ${e instanceof Error ? e.message : String(e)}`,
            command: commandType.debug,
            details: e
        };
    }
}
