import { _decorator } from 'cc';
import { IScene, ISentence } from '../../../res-native/script/webGal/parser/interface/sceneInterface';
import { VnParser } from './VnParser';
import { app } from '../../../app/app';
import { VnScriptHelper } from './VnScriptHelper';

/**
 * 场景管理器
 * 负责场景的加载、切换、栈管理和解析
 */
export class VnSceneManager {
    // 场景管理相关属性
    private currentScene: IScene | null = null;
    private currentSentenceId: number = 0;
    private sceneStack: Array<{sceneName: string, returnIndex: number}> = [];
    
    // 依赖注入：日志函数、VnParser、VnScriptHelper 和回调函数
    private logFunc: (message: string, ...args: any[]) => void;
    private warnFunc: (message: string, ...args: any[]) => void;
    private errorFunc: (message: string, ...args: any[]) => void;
    private vnParser: VnParser;
    private vnScriptHelper: VnScriptHelper; // 注入 VnScriptHelper
    private scriptExecutorFunc: () => void; // 用于在加载或恢复场景后触发脚本执行
    private curNovelBundleName: string; // 需要从 VnManager 获取，但现在主要由 VnScriptHelper 处理加载，此属性可能不再需要直接用于加载

    /**
     * 构造函数
     * @param logFunc 日志函数
     * @param warnFunc 警告函数
     * @param errorFunc 错误函数
     * @param vnParser VnParser 实例
     * @param vnScriptHelper VnScriptHelper 实例
     * @param scriptExecutorFunc 脚本执行器回调函数
     * @param curNovelBundleName 当前小说 bundle 名称 (可能不再直接用于加载)
     */
    constructor(
        logFunc: (message: string, ...args: any[]) => void,
        warnFunc: (message: string, ...args: any[]) => void,
        errorFunc: (message: string, ...args: any[]) => void,
        vnParser: VnParser,
        vnScriptHelper: VnScriptHelper,
        scriptExecutorFunc: () => void,
        curNovelBundleName: string // 仍然接收以防将来需要，但load逻辑移到_loadSceneText并使用VnScriptHelper
    ) {
        this.logFunc = logFunc;
        this.warnFunc = warnFunc;
        this.errorFunc = errorFunc;
        this.vnParser = vnParser;
        this.vnScriptHelper = vnScriptHelper; // 存储注入的 VnScriptHelper
        this.scriptExecutorFunc = scriptExecutorFunc;
        this.curNovelBundleName = curNovelBundleName; // 存储以防需要
    }

    /**
     * 获取当前场景
     */
    public getCurrentScene(): IScene | null {
        return this.currentScene;
    }

     /**
     * 获取当前语句ID
     */
    public getCurrentSentenceId(): number {
        return this.currentSentenceId;
    }

    /**
     * 增加语句ID
     */
    public incrementSentenceId(): void {
        this.currentSentenceId++;
    }

     /**
      * 设置语句ID
      * @param id 语句ID
      */
    public setSentenceId(id: number): void {
        this.currentSentenceId = id;
    }
    
    /**
     * 加载并设置当前场景
     * @param sceneName 场景名称
     * @param sceneText 场景文本
     * @returns 解析后的场景
     */
    public loadScene(sceneName: string, sceneText: string): IScene | null {
        // 使用VnParser解析场景
        const scene = this.parseWebGalScene(sceneText, sceneName);
        if (!scene) {
            this.errorFunc(`解析场景失败: ${sceneName}`);
            return null;
        }
        
        this.currentScene = scene;
        this.currentSentenceId = 0;
        this.logFunc(`加载场景: ${sceneName}, 共${scene.sentenceList.length}条语句`);
        return scene;
    }
    
    /**
     * 辅助方法：加载场景文本 (现在通过 VnScriptHelper 获取)
     * @param sceneName 场景名称
     * @param onComplete 加载完成回调 (接收字符串或null)
     * @private
     */
    private _loadSceneText(sceneName: string, onComplete: (scriptText: string | null) => void): void {
        this.logFunc(`开始通过 VnScriptHelper 获取场景文本: ${sceneName}`);
        // 使用注入的 VnScriptHelper 来获取脚本内容
        const scriptText = this.vnScriptHelper.getSceneScript(sceneName);
        // 直接调用回调函数传递获取到的文本
        onComplete(scriptText);
    }

    /**
     * 处理场景切换
     * @param sceneName 场景名称
     */
    public changeScene(sceneName: string) {
        this.logFunc(`切换场景: ${sceneName}`);
        // 加载目标场景文本 (现在通过 _loadSceneText 获取)
        this._loadSceneText(sceneName, (sceneText) => { // 回调函数现在接收 scriptText
            if (sceneText !== null) { // 检查是否获取到文本
                const scene = this.loadScene(sceneName, sceneText);
                if (scene) {
                    // 成功加载场景后开始执行
                    this.scriptExecutorFunc(); // 调用回调函数触发脚本执行
                }
            } else {
                this.errorFunc(`加载场景文件失败或未找到场景脚本: ${sceneName}`);
            }
        });
    }
    
    /**
     * 保存当前场景并切换到新场景(callScene功能)
     * @param sceneName 要调用的场景名称
     */
    public callScene(sceneName: string) {
        if (this.currentScene) {
            this.sceneStack.push({
                sceneName: this.currentScene.sceneName,
                returnIndex: this.currentSentenceId
            });
            this.logFunc(`保存当前场景到场景栈: ${this.currentScene.sceneName} 位置: ${this.currentSentenceId}`);
        }
        this.changeScene(sceneName);
    }
    
    /**
     * 从场景栈恢复场景
     */
    public restoreScene() {
        if (this.sceneStack.length > 0) {
            const lastScene = this.sceneStack.pop();
            if (lastScene) {
                this.logFunc(`从场景栈恢复场景: ${lastScene.sceneName} 位置: ${lastScene.returnIndex}`);
                // 暂存要恢复的位置
                const returnIndex = lastScene.returnIndex;
                
                // 加载目标场景文本 (现在通过 _loadSceneText 获取)
                this._loadSceneText(lastScene.sceneName, (sceneText) => { // 回调函数现在接收 scriptText
                    if (sceneText !== null) { // 检查是否获取到文本
                        const scene = this.loadScene(lastScene.sceneName, sceneText);
                        if (scene) {
                            // 场景加载完成后，设置正确的语句索引
                            this.currentSentenceId = returnIndex;
                            // 开始执行
                            this.scriptExecutorFunc(); // 调用回调函数触发脚本执行
                        }
                    } else {
                        this.errorFunc(`恢复场景文件失败或未找到场景脚本: ${lastScene.sceneName}`);
                    }
                });
            }
        }
    }

    public startFromBeginning(script: VnScriptHelper) { // 参数类型改为 VnScriptHelper
        // 创建测试场景 (直接使用传入的 scriptHelper 获取脚本)
        const sceneText = script.getSceneScript('1_1');

        if (sceneText !== null) {
            const scene = this.loadScene('1_1', sceneText);
            
            if (scene) {
                // 开始执行脚本
                this.scriptExecutorFunc(); // 调用回调函数触发脚本执行
            }
            return scene;
        } else {
            this.errorFunc('startFromBeginning: 未找到场景 1_1 的脚本');
            return null;
        }
    }
    
    /**
     * 解析WebGAL场景
     * @param rawSceneText 原始场景文本
     * @param sceneName 场景名称
     * @param sceneUrl 场景URL（可选）
     * @returns 解析后的场景
     */
    public parseWebGalScene(rawSceneText: string, sceneName: string, sceneUrl: string = ''): IScene | null {
        if (!this.vnParser) {
            this.errorFunc('VnParser尚未初始化');
            return null;
        }
        
        try {
            // 先进行文本预处理
            const processedText = this.vnParser.preProcessSceneText(rawSceneText);
            // 解析场景
            return this.vnParser.parseScene(processedText, sceneName, sceneUrl);
        } catch (e) {
            this.errorFunc('解析WebGAL场景失败:', e);
            return null;
        }
    }
    
    /**
     * 解析WebGAL配置
     * @param configText 配置文本
     * @returns 解析后的配置
     */
    public parseWebGalConfig(configText: string) {
        if (!this.vnParser) {
            this.errorFunc('VnParser尚未初始化');
            return null;
        }
        
        try {
            return this.vnParser.parseConfig(configText);
        } catch (e) {
            this.errorFunc('解析WebGAL配置失败:', e);
            return null;
        }
    }

    /**
     * 获取当前语句
     * @returns 当前语句或null
     */
    public getCurrentSentence(): ISentence | null {
        if (!this.currentScene || this.currentSentenceId >= this.currentScene.sentenceList.length) {
            return null;
        }
        return this.currentScene.sentenceList[this.currentSentenceId];
    }

    /**
     * 检查是否到达场景末尾
     */
    public isEndOfScene(): boolean {
        if (!this.currentScene) {
            return true; // No scene loaded means end of scene
        }
        return this.currentSentenceId >= this.currentScene.sentenceList.length;
    }

    /**
     * 检查场景栈是否为空
     */
    public isSceneStackEmpty(): boolean {
        return this.sceneStack.length === 0;
    }
} 