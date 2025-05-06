// import { app } from "../../app/app"; // FIXME: Path resolution error
// import { ISentence } from "../../../res-native/script/webGal/parser/interface/ISentence"; // FIXME: Path resolution error
import { app } from "db://assets/app/app";
import { ICocosPerformHandle, ScriptHandlerFunc, VnCommandError, StopHandlerFunc, isVnCommandError } from "../vnTypes";
// import { commandType } from "../../../res-native/script/webGal/parser/config/commandType"; // FIXME: Path resolution error

// FIXME: Replace 'any' with actual commandType enum/object when path is resolved
const commandType = { changeBg: 'changeBg' }; 

/**
 * 处理切换背景命令
 * @param args [背景资源路径, (可选)转场效果, (可选)时长]
 * @param sentence 
 * @returns 
 */
// FIXME: Replace 'any' with ISentence when path is resolved
export const handleChangeBg: ScriptHandlerFunc = (args: any[], sentence: any): ICocosPerformHandle | VnCommandError => {
    try {
        const newPath = sentence.content as string | null;
        
        if (typeof newPath !== 'string' && newPath !== null) {
            return { 
                isError: true, 
                message: `changeBg 命令需要一个字符串路径或 null 作为第一个参数，但收到: ${newPath}`
                // command: commandType.changeBg // 移除 command 字段以匹配类型
            };
        }

        console.log(`[VnManager] 执行 handleChangeBg: ${newPath}`);
        app.store.vn.setBackground(newPath); // FIXME: 需要 app 的正确导入才能更新 store
        
        return {
            performName: `${commandType.changeBg}_${Date.now()}`,
            duration: 0, 
            goNextWhenOver: true, 
            isHoldOn: false, 
            blockingAuto: () => true, 
            blockingNext: () => false,
            customData: { path: newPath } 
        };
    } catch (error: any) { 
        return { 
            isError: true, 
            message: `handleChangeBg 执行出错: ${error.message || error}`,
            // command: commandType.changeBg, // 移除 command 字段以匹配类型
            details: error
        };
    }
};

// 可选: 实现 stopChangeBg
// export const stopChangeBg: StopHandlerFunc = (performName: string, customData?: any): void | VnCommandError => {
//     console.log(`[VnManager] 停止 changeBg: ${performName}`, customData);
//     return undefined; 
// }; 