import { _decorator } from 'cc';
import { ICommandHandlers, ScriptHandlerFunc, StopHandlerFunc, VnCommandError, isVnCommandError, ICocosPerformHandle } from "./vnTypes";
import { ISentence, commandType } from '../../../res-native/script/webGal/parser/interface/sceneInterface';
import { handleSay } from './commands/dialogCommands';
import { handleChangeBg } from './commands/graphicsCommands';
import { handleDebug } from './commands/debugCommands';
import { handlechangeFigureCommand } from './commands/changeFigure';
import { handleBgmCommand } from './commands/bgm';
import { handleSoundEffectCommand } from './commands/soundEffect';
import { handleIntro, stopIntroFunction } from './commands/intro';
import { handleShowCg } from './commands/showCg';
import { VnPerformManager } from './VnPerformManager';
import { handleSetVar } from './commands/variableCommands';

/**
 * 命令管理器
 * 负责命令的注册、查找和执行
 */
export class VnCommandManager {
    // 命令注册表
    private scriptRegistry: Map<commandType, ICommandHandlers> = new Map();

    // 依赖注入：日志函数和表现管理器
    private logFunc: (message: string, ...args: any[]) => void;
    private warnFunc: (message: string, ...args: any[]) => void;
    private errorFunc: (message: string, ...args: any[]) => void;
    private vnPerformManager: VnPerformManager;
    
    /**
     * 构造函数
     * @param logFunc 日志函数
     * @param warnFunc 警告函数
     * @param errorFunc 错误函数
     * @param vnPerformManager 表现管理器实例
     */
    constructor(
        logFunc: (message: string, ...args: any[]) => void,
        warnFunc: (message: string, ...args: any[]) => void,
        errorFunc: (message: string, ...args: any[]) => void,
        vnPerformManager: VnPerformManager
    ) {
        this.logFunc = logFunc;
        this.warnFunc = warnFunc;
        this.errorFunc = errorFunc;
        this.vnPerformManager = vnPerformManager;

        // 注册内置命令
        this._registerBuiltinCommands();
    }
    
    /**
     * 注册命令处理器
     * @param commandType 命令类型
     * @param scriptHandler 脚本处理函数
     * @param stopHandler 停止处理函数(可选)。
     * @returns void
     */
    public registerCommand(commandType: commandType, scriptHandler: ScriptHandlerFunc, stopHandler?: StopHandlerFunc): void {
        if (this.scriptRegistry.has(commandType)) {
            this.warnFunc(`命令 ${commandType} 已存在，将被覆盖`);
        }
        
        this.scriptRegistry.set(commandType, {
            scriptHandler,
            stopHandler
        });
        
        this.logFunc(`注册命令: ${commandType}`);
    }
    
    /**
     * 注册内置命令
     * @private
     * @returns void
     */
    private _registerBuiltinCommands(): void {
        this.logFunc('注册内置命令');
        
        // 注册intro命令
        this.registerCommand(commandType.intro, handleIntro, stopIntroFunction);
        this.logFunc('intro命令注册完成');
        
        // 注册say命令
        this.registerCommand(commandType.say, handleSay);
        this.logFunc('say命令注册完成');
        
        // 注册changeBg命令
        this.registerCommand(commandType.changeBg, handleChangeBg);
        this.logFunc('changeBg命令注册完成');
        
        // 注册changeFigure命令
        this.registerCommand(commandType.changeFigure, handlechangeFigureCommand);
        this.logFunc('changeFigure命令注册完成');
        
        // 注册debug命令
        this.registerCommand(commandType.debug, handleDebug);
        this.logFunc('debug命令注册完成');

        // 注册bgm命令
        this.registerCommand(commandType.bgm, handleBgmCommand);
        this.logFunc('bgm命令注册完成');

        // 注册playEffect命令
        this.registerCommand(commandType.playEffect, handleSoundEffectCommand);
        this.logFunc('playEffect命令注册完成');

        // 注册showCg命令
        this.registerCommand(commandType.showCg, handleShowCg);
        this.logFunc('showCg命令注册完成');

        // 注册 setVar 命令
        this.registerCommand(commandType.setVar, handleSetVar);
        this.logFunc('setVar命令注册完成');
    }
    
    /**
     * 运行脚本
     * @param sentence 句子对象
     * @returns Promise<ICocosPerformHandle | VnCommandError> | ICocosPerformHandle | VnCommandError - 返回处理结果，可能是 Promise 或直接值
     */
    public runScript(sentence: ISentence): Promise<ICocosPerformHandle | VnCommandError> | ICocosPerformHandle | VnCommandError {
        this.logFunc(`执行命令: ${commandType[sentence.command]}`, sentence);
        
        // 查找命令处理器
        const handlers = this.scriptRegistry.get(sentence.command);
        if (!handlers) {
            const error: VnCommandError = {
                isError: true,
                message: `未找到命令处理器: ${commandType[sentence.command]}`,
                command: sentence.command
            };
            this.errorFunc(error.message);
            return error; // Return error directly
        }
        
        try {
            // 调用处理函数，获取初始结果 (可能是一个 Promise 或直接值)
            const initialResultOrPromise = handlers.scriptHandler(sentence.args, sentence);
            
            // Handle both direct results and Promises returned by scriptHandler
            return Promise.resolve(initialResultOrPromise)
                .then((initialResult) => { // Let TS infer type first, then refine logic inside
                    // 检查是否为错误
                    if (isVnCommandError(initialResult)) {
                        this.errorFunc(`命令执行错误: ${initialResult.message}`, initialResult.details);
                        return initialResult; // Propagate error
                    }

                    // initialResult is now guaranteed NOT to be VnCommandError
                    // Check if it contains arrangePerformPromise and is a Promise
                    if ('arrangePerformPromise' in initialResult && initialResult.arrangePerformPromise instanceof Promise) {
                        this.logFunc(`检测到arrangePerformPromise，等待Promise解析...`);
                        // Await the promise using .then()
                        // Explicitly type the resolved value of the promise
                        return initialResult.arrangePerformPromise
                            .then((finalHandle: ICocosPerformHandle | VnCommandError) => { // Explicitly type finalHandle
                                // 检查最终句柄是否为错误（以防arrangePerformPromise解析出错误）
                                if (isVnCommandError(finalHandle)) {
                                    this.errorFunc(`arrangePerformPromise解析后句柄为错误: ${finalHandle.message}`, finalHandle.details);
                                    return finalHandle; // Propagate error
                                }

                                this.logFunc(`arrangePerformPromise解析完成，获得最终句柄:`, finalHandle);
                                // 安排新的表现 - 调用VnPerformManager
                                this.vnPerformManager.arrangeNewPerform(finalHandle, handlers.stopHandler, sentence);
                                return finalHandle; // Return the final handle
                            })
                            .catch((e: any) => { // Explicitly type catch parameter
                                const error: VnCommandError = {
                                    isError: true,
                                    message: `arrangePerformPromise解析异常: ${e instanceof Error ? e.message : String(e)}`, // Check if e is Error
                                    command: sentence.command,
                                    details: e
                                };
                                this.errorFunc(error.message, error.details);
                                return error; // Propagate error
                            });
                    } else {
                        // Otherwise, the initial result is the final handle (should be ICocosPerformHandle)
                        const finalHandle = initialResult as ICocosPerformHandle; // Cast to ICocosPerformHandle
                        this.logFunc(`句柄不包含arrangePerformPromise，直接使用初始句柄:`, finalHandle);

                        // 安排新的表现 - 调用VnPerformManager
                        this.vnPerformManager.arrangeNewPerform(finalHandle, handlers.stopHandler, sentence);
                        return finalHandle; // Return the final handle
                    }
                })
                .catch((e: any) => { // Explicitly type catch parameter
                    // Handle errors from the initial scriptHandler call or the first .then()
                    const error: VnCommandError = {
                        isError: true,
                        message: `命令处理函数执行或Promise异常: ${e instanceof Error ? e.message : String(e)}`, // Use e.message as e is Error
                        command: sentence.command,
                        details: e
                    };
                    this.errorFunc(error.message, error.details);
                    return error; // Propagate error
                });
            
        } catch (e: any) { // Catch any synchronous errors from getting handlers or initial call setup
            const error: VnCommandError = {
                isError: true,
                message: `命令执行异常 (同步): ${e instanceof Error ? e.message : String(e)}`, // Check if e is Error
                command: sentence.command,
                details: e
            };
            this.errorFunc(error.message, error.details);
            return error; // Return error for synchronous errors
        }
    }
} 