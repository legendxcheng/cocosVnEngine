import { ISentence, commandType } from '../../../res-native/script/webGal/parser/interface/sceneInterface';

/**
 * 表示不执行任何表现的特殊常量
 */
export const WEBGAL_NONE = 'WEBGAL_NONE';

/**
 * 表现函数返回的错误对象
 */
export interface VnCommandError {
    isError: true;
    message: string;
    command?: commandType;
    details?: any;
}

/**
 * 类型守卫：判断是否为VnCommandError
 */
export function isVnCommandError(obj: any): obj is VnCommandError {
    return obj && typeof obj === 'object' && obj.isError === true;
}

/**
 * Cocos表现句柄接口，用于管理表现的生命周期
 */
export interface ICocosPerformHandle {
    // 表现的唯一标识
    performName: string;
    // 表现持续时间(毫秒)，为0表示无限持续
    duration: number;
    // 表现结束后是否继续执行下一句(可选)
    goNextWhenOver?: boolean;
    // 是否处于保持状态(true则不会自动清理)
    isHoldOn: boolean;
    // 是否阻塞自动播放
    blockingAuto: () => boolean;
    // 演出是否阻塞游戏流程继续（一个函数，返回 boolean类型的结果，判断要不要阻塞）
    blockingNext: () => boolean;
    // 跳过由 nextSentence 函数引发的演出回收 (例如音效、语音)
    skipNextCollect?: boolean;
    // 停止函数(可选)
    stopFunction?: (performName: string, customData?: any) => void | VnCommandError;
    // 自定义数据(可选)
    customData?: any;
    // 对于延迟触发的演出，使用 Promise (可选)
    arrangePerformPromise?: Promise<ICocosPerformHandle>;
}

/**
 * 脚本处理函数类型
 */
export type ScriptHandlerFunc = (args: any[], sentence: ISentence) => ICocosPerformHandle | Promise<ICocosPerformHandle> | { arrangePerformPromise: Promise<ICocosPerformHandle> } | VnCommandError;

/**
 * 停止处理函数类型
 */
export type StopHandlerFunc = (performName: string, customData?: any) => void | VnCommandError;

/**
 * 命令处理器接口
 */
export interface ICommandHandlers {
    scriptHandler: ScriptHandlerFunc;
    stopHandler?: StopHandlerFunc;
} 