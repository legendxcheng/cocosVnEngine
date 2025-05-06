import { _decorator } from 'cc';
import BaseManager from '../../../../extensions/app/assets/base/BaseManager';
import { IScene, ISentence, commandType } from '../../../../assets/res-native/script/webGal/parser/interface/sceneInterface';
import { VnParser } from './VnParser';
import { ICommandHandlers, ICocosPerformHandle, ScriptHandlerFunc, StopHandlerFunc, isVnCommandError, WEBGAL_NONE, VnCommandError } from './vnTypes';
import { IBacklogItem } from '../../app-model/store.vn';
import { app } from '../../../app/app';
import { VnScriptHelper } from './VnScriptHelper';
import { VnPerformManager } from './VnPerformManager';
import { VnCommandManager } from './VnCommandManager';
import { VnSceneManager } from './VnSceneManager';
import { Parser } from 'expr-eval/dist/index.mjs';

const { ccclass, property } = _decorator;
@ccclass('VnManager')
export class VnManager extends BaseManager {
    private _script: VnScriptHelper;
    public set script(value: any) {
        this._script = new VnScriptHelper(value);
    }

    public get script() {
        return this._script;
    }

    public curNovelBundleName:string = "novel-bundle-exmaple"
    // WebGAL解析器实例
    private vnParser!: VnParser;
    
    // 命令管理器
    private vnCommandManager!: VnCommandManager;
    
    // 表现管理器
    private vnPerformManager!: VnPerformManager;

    // 场景管理器
    private vnSceneManager!: VnSceneManager;
    
    // [无序] 加载完成时触发
    protected onLoad() { 
        console.log('VnManager onLoad');
    }

    // [无序] 自身初始化完成, init执行完毕后被调用
    protected onInited() {
        // 初始化解析器
        this.vnParser = new VnParser();
        this.log('WebGAL解析器初始化完成');
        
        // 初始化表现管理器
        this.vnPerformManager = new VnPerformManager(
            (...args) => this.log(...args),
            (...args) => this.warn(...args),
            (...args) => this.error(...args),
            () => this.nextSentence()
        );
        this.log('表现管理器初始化完成');

        // 初始化命令管理器
        this.vnCommandManager = new VnCommandManager(
            (...args) => this.log(...args),
            (...args) => this.warn(...args),
            (...args) => this.error(...args),
            this.vnPerformManager
        );
        this.log('命令管理器初始化完成');

        // 初始化场景管理器
        this.vnSceneManager = new VnSceneManager(
            (...args) => this.log(...args),
            (...args) => this.warn(...args),
            (...args) => this.error(...args),
            this.vnParser, // 传入 VnParser 实例
            this.script, // 传入 VnScriptHelper 实例
            () => this.scriptExecutor(), // 传入 scriptExecutor 方法引用
            this.curNovelBundleName // 传入当前 novel bundle 名称
        );
        this.log('场景管理器初始化完成');
    }

    // [无序] 所有manager初始化完成
    protected onFinished() { }

    // [无序] 初始化manager，在初始化完成后，调用finish方法
    protected init(finish: Function) {
        super.init(finish);
    }
    
    /**
     * 注册命令处理器
     * @param commandType 命令类型
     * @param scriptHandler 脚本处理函数
     * @param stopHandler 停止处理函数(可选)
     */
    public registerCommand(commandType: commandType, scriptHandler: ScriptHandlerFunc, stopHandler?: StopHandlerFunc) {
        // 调用命令管理器的同名方法
        this.vnCommandManager.registerCommand(commandType, scriptHandler, stopHandler);
    }
    
    /**
     * 注册内置命令
     * @private
     */
    private _registerBuiltinCommands() {
        // Built-in commands are now registered within VnCommandManager's constructor
        // This method can be removed or kept as a placeholder if needed later
    }
    
    /**
     * 运行脚本
     * @param sentence 句子对象
     */
    public runScript(sentence: ISentence) {
        // 调用命令管理器的同名方法
        // runScript现在返回Promise或直接值，需要处理
        const scriptResult = this.vnCommandManager.runScript(sentence);
    
        // Handle both direct results and Promises returned by runScript
        Promise.resolve(scriptResult).then(result => {
             // 检查是否为错误
             if (isVnCommandError(result)) {
                 this.error(`脚本执行错误: ${result.message}`, result.details);
                 // TODO: 处理脚本执行错误，例如停止执行或跳过
                 return; // Stop processing on error
             }
    
             // 检查是否有next参数
             let isNext = sentence.args.some(arg => arg.key === 'next' && arg.value === true);
             
             // 是否保存backlog(通常是对话)
             let isSaveBacklog = sentence.command === commandType.say;
             
             // 检查notend参数
             if (sentence.args.some(arg => arg.key === 'notend' && arg.value === true)) {
                 isSaveBacklog = false;
             }
             
             // 保存backlog
             if (isSaveBacklog) {
                 this.saveToBacklog(sentence);
             }
             
             // 增加语句ID - 调用场景管理器的方法
             this.vnSceneManager.incrementSentenceId();
             
             // 如果有next参数，立即执行下一句
             if (isNext) {
                 this.scriptExecutor();
             }
        }).catch(e => {
             this.error('脚本执行runScript时发生未捕获异常:', e);
        });
    }
    
    /**
     * 卸载表现 (标准API)
     * @param performName 表现名称
     */
    public unmountPerform(performName: string) {
        // 调用表现管理器的同名方法
        this.vnPerformManager.unmountPerform(performName);
    }
    
    /**
     * 执行下一句
     * 由用户点击或系统自动触发
     * 以galGame的逻辑来说，如果当前有演出没演完，点击时，会将所有未演完的演出清理掉，而不执行下一句。
        如果当前所有演出都演完了，那么就会执行下一句。
        这是galGame的传统规则。
        
        清理规则具体来说：
        1. 如果一个演出的isHoldOn为false，那么进行下一步判断：
            如果这个演出的skipNextCollect为true，那么这个演出就不会被清理掉
            如果这个演出的skipNextCollect为false，那么这个演出就会被清理掉
        2. 如果一个演出的isHoldOn为true，那么这个演出就不会被清理掉

        如果当前没有需要清理的演出，就执行下一句
    */
    public nextSentence() {
        // 1. 发送用户点击下一句事件
        app.manager.event.emit('VN_USER_INTERACT_NEXT');
        
        // 2. 检查是否存在blockNext的演出
        let isBlockingNext = this.vnPerformManager.hasBlockingNextPerform();
        
        if (isBlockingNext) {
            this.warn('nextSentence被阻塞!');
            return;
        }
        
        // 3. 处理表现清理和下一句判断
        const { allSettled, isGoNext, performNamesToRemove } = this.vnPerformManager.processNextSentence();
        
        if (allSettled) {
            // 执行下一条脚本
            this.scriptExecutor();
            return;
        }
        
        // 如果有表现设置了goNextWhenOver为true，则继续执行下一句
        if (isGoNext) {
            this.log('检测到被强制结束的表现中有goNextWhenOver=true, 触发下一句');
            // 注意：这里调用 nextSentence 是安全的，因为它是由用户点击触发的强制结束流程的一部分
            this.nextSentence(); 
        }
    }
    
    /**
     * 脚本执行器
     * 执行当前场景的下一句脚本
     * @private
     */
    private scriptExecutor() {
        // 检查是否有场景 - 调用场景管理器的方法
        if (!this.vnSceneManager.getCurrentScene()) {
            this.error('没有加载场景，无法执行脚本');
            return;
        }
        
        // 检查是否到达场景末尾 - 调用场景管理器的方法
        if (this.vnSceneManager.isEndOfScene()) {
            // 尝试从场景栈恢复场景 - 调用场景管理器的方法
            if (!this.vnSceneManager.isSceneStackEmpty()) {
                this.vnSceneManager.restoreScene();
            } else {
                this.log('已到达脚本末尾');
            }
            return;
        }
        
        // 获取当前语句 - 调用场景管理器的方法
        const currentScript = this.vnSceneManager.getCurrentSentence();

        // 确保获取到了语句（理论上上面已经检查过末尾，这里是保险起见）
        if (!currentScript) {
             this.error('无法获取当前语句');
             return;
        }
        
        // --- Start: Variable Preprocessing ---

        // Helper function for interpolation
        const interpolate = (text: string): string => {
            if (typeof text !== 'string') return text; // Ensure text is string
            try {
                // Regex to find {variable}, (?<!\\) to handle escaped \{
                return text.replace(/(?<!\\)\{([a-zA-Z0-9_.]+)\}/g, (match, varName) => {
                     // Get variable value from store
                     const value = app.store.vn.gameVars[varName];
                     if (value === undefined) {
                         this.warn(`Variable interpolation: Variable '{${varName}}' not found.`);
                         return `{${varName}}`; // Return original placeholder if not found
                     }
                     return String(value); // Return string representation of the value
                }).replace(/\\{/g, '{').replace(/\\}/g, '}'); // Handle escaped \{ -> { , \} -> }
            } catch(e: any) {
                this.error(`Error during variable interpolation for text: "${text}"`, e);
                return text; // Return original text on error
            }
        };

        // Apply variable interpolation to content and string arguments
        currentScript.content = interpolate(currentScript.content);
        currentScript.args = currentScript.args.map(arg => {
            if (typeof arg.value === 'string') {
                return { ...arg, value: interpolate(arg.value) };
            }
            return arg;
        });

        // Check and evaluate -when condition
        const whenArg = currentScript.args.find(arg => arg.key === 'when');
        if (whenArg) {
            const conditionString = String(whenArg.value);
            try {
                // Instantiate Parser for condition evaluation
                const parser = new Parser({ allowMemberAccess: false });
                 // Add random() function support (optional for when, but consistent)
                parser.functions.random = Math.random;

                // Create evaluation context
                const context = { ...app.store.vn.gameVars };

                const shouldRun = parser.evaluate(conditionString, context);

                if (!shouldRun) {
                    this.log(`条件 "-when=${conditionString}" 不满足，跳过语句: ${commandType[currentScript.command]}`);
                    this.vnSceneManager.incrementSentenceId();
                    // Use setTimeout to prevent stack overflow in case of consecutive skipped lines
                    setTimeout(() => this.scriptExecutor(), 0);
                    return; // Skip subsequent execution of this sentence
                }
            } catch (e: any) {
                this.error(`"-when" condition error: ${e.message}. Skipping sentence.`, { condition: conditionString, error: e });
                this.vnSceneManager.incrementSentenceId();
                 // Use setTimeout to prevent stack overflow
                setTimeout(() => this.scriptExecutor(), 0);
                return; // Skip sentence on condition evaluation error
            }
        }

        // --- End: Variable Preprocessing ---

        // 执行语句 (注意 runScript 是异步的，但也可能同步返回错误)
        // 脚本执行器现在只负责获取语句并调用runScript，不处理runScript返回的Promise或错误
        // runScript中的then/catch逻辑已经移动到runScript方法本身中处理了
        this.runScript(currentScript);

        // runScript内部会处理next参数和推进currentSentenceId，所以这里不需要再处理了
        // runScript内部也处理了backlog保存
    }
    
    /**
     * 保存语句到backlog
     * @param sentence 要保存的语句
     * @private
     */
    private saveToBacklog(sentence: ISentence) {
        // 创建基本backlog项
        const backlogItem: IBacklogItem = {
            type: sentence.command === commandType.say ? 'dialog' : 'command',
            timestamp: Date.now()
        };
        
        // 根据类型填充不同信息
        if (sentence.command === commandType.say) {
            // 分析语句获取说话者和内容
            let speaker = '';
            let speakerArg = sentence.args.find(arg => arg.key === 'speaker');
            if (speakerArg) {
                speaker = String(speakerArg.value);
            }
            
            backlogItem.speaker = speaker;
            backlogItem.text = sentence.content;
            
            // 创建状态快照
            backlogItem.snapshot = {
                background: app.store.vn.currentBackground || undefined,
                // 添加其他状态...
            };
        } else {
            // 其他类型命令的处理
            backlogItem.command = commandType[sentence.command];
        }
        
        // 保存到store
        app.store.vn.addBacklogItem(backlogItem);
    }
    
    /**
     * 加载并设置当前场景
     * @param sceneName 场景名称
     * @param sceneText 场景文本
     * @returns 解析后的场景
     */
    public loadScene(sceneName: string, sceneText: string): IScene | null {
        // 调用场景管理器的同名方法
        return this.vnSceneManager.loadScene(sceneName, sceneText);
    }
    
    /**
     * 处理场景切换
     * @param sceneName 场景名称
     */
    public changeScene(sceneName: string) {
        // 调用场景管理器的同名方法
        this.vnSceneManager.changeScene(sceneName);
    }
    
    /**
     * 保存当前场景并切换到新场景(callScene功能)
     * @param sceneName 要调用的场景名称
     */
    public callScene(sceneName: string) {
        // 调用场景管理器的同名方法
        this.vnSceneManager.callScene(sceneName);
    }
    
    /**
     * 从场景栈恢复场景
     */
    public restoreScene() {
        // 调用场景管理器的同名方法
        this.vnSceneManager.restoreScene();
    }

    public startFromBeginning() {
        // 调用场景管理器的同名方法，并传入this.script
        return this.vnSceneManager.startFromBeginning(this.script);
    }
    
    /**
     * 解析WebGAL场景
     * @param rawSceneText 原始场景文本
     * @param sceneName 场景名称
     * @param sceneUrl 场景URL（可选）
     * @returns 解析后的场景
     */
    public parseWebGalScene(rawSceneText: string, sceneName: string, sceneUrl: string = ''): IScene | null {
       // 调用场景管理器的同名方法
       return this.vnSceneManager.parseWebGalScene(rawSceneText, sceneName, sceneUrl);
    }
    
    /**
     * 解析WebGAL配置
     * @param configText 配置文本
     * @returns 解析后的配置
     */
    public parseWebGalConfig(configText: string) {
       // 调用场景管理器的同名方法
       return this.vnSceneManager.parseWebGalConfig(configText);
    }

    public setScript(script: any) {
        this.script = script;
    }
    
}