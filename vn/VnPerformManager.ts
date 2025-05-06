import { _decorator } from 'cc';
import { ICocosPerformHandle, StopHandlerFunc, isVnCommandError, WEBGAL_NONE, VnCommandError } from './vnTypes';
import { ISentence, commandType } from '../../../res-native/script/webGal/parser/interface/sceneInterface';
import { app } from '../../../app/app';
import { IVnPerform } from '../../app-model/store.vn';

/**
 * 表现管理器
 * 负责管理视觉小说中各种表现效果的生命周期
 */
export class VnPerformManager {
    // 活跃的表现
    private activePerforms: Map<string, ICocosPerformHandle> = new Map();
    
    // 表现定时器
    private performTimers: Map<string, number> = new Map();
    
    // 依赖注入：日志函数和回调函数
    private logFunc: (message: string, ...args: any[]) => void;
    private warnFunc: (message: string, ...args: any[]) => void;
    private errorFunc: (message: string, ...args: any[]) => void;
    private nextSentenceFunc: () => void;
    
    /**
     * 构造函数
     * @param logFunc 日志函数
     * @param warnFunc 警告函数
     * @param errorFunc 错误函数
     * @param nextSentenceFunc 执行下一句的函数
     */
    constructor(
        logFunc: (message: string, ...args: any[]) => void,
        warnFunc: (message: string, ...args: any[]) => void,
        errorFunc: (message: string, ...args: any[]) => void,
        nextSentenceFunc: () => void
    ) {
        this.logFunc = logFunc;
        this.warnFunc = warnFunc;
        this.errorFunc = errorFunc;
        this.nextSentenceFunc = nextSentenceFunc;
    }
    
    /**
     * 安排新的表现
     * @param handle 表现句柄
     * @param stopHandler 停止处理函数
     * @param sentence 原始句子对象(可选)
     */
    public arrangeNewPerform(handle: ICocosPerformHandle, stopHandler?: StopHandlerFunc, sentence?: ISentence) {
        this.logFunc(`安排新表现: ${handle.performName}`, handle);
        
        // 特殊处理：WEBGAL_NONE表示不执行任何表现
        if (handle.performName === WEBGAL_NONE) {
            this.logFunc(`表现为 ${WEBGAL_NONE}，跳过表现处理`);
            return;
        }
        
        // 检查是否已存在同名表现，如果存在则先卸载
        if (this.activePerforms.has(handle.performName)) {
            this.logFunc(`表现 ${handle.performName} 已存在，将被替换`);
            // 注意：这里调用unmountPerform是安全的，因为它处理的是单个表现的替换，而非nextSentence的批量清理
            this.unmountPerform(handle.performName);
        }
        
        // 添加到活跃表现
        this.activePerforms.set(handle.performName, handle);
        
        // 添加到Store中的表现列表
        const performData: IVnPerform = {
            performName: handle.performName,
            isHoldOn: handle.isHoldOn,
            // 将 skipNextCollect 也存入 store，以便在 if(allSettled) 中使用
            customData: { ...handle.customData, skipNextCollect: handle.skipNextCollect }
        };
        app.store.vn.addPerform(performData);
        
        // 如果提供了stopHandler，则设置给handle
        if (stopHandler) {
            handle.stopFunction = stopHandler;
        }
        
        // 处理continue参数
        if (sentence) {
            const continueArg = sentence.args.find(arg => arg.key === 'continue' && arg.value === true);
            if (continueArg) {
                this.logFunc(`检测到continue=true参数，设置表现 ${handle.performName} 的goNextWhenOver=true`);
                handle.goNextWhenOver = true;
            }
        }
        
        // 如果有持续时间且不是保持状态，则设置定时器自动卸载
        if (handle.duration > 0 && !handle.isHoldOn) {
            const timerId = setTimeout(() => {
                this.unmountPerform(handle.performName);
            }, handle.duration);
            
            // 存储定时器ID
            this.performTimers.set(handle.performName, timerId);
            this.logFunc(`设置表现 ${handle.performName} 的自动卸载定时器: ${timerId}, 持续时间: ${handle.duration}ms`);
        }
        
        this.logFunc(`当前活跃表现数: ${this.activePerforms.size}`);

        // 在处理完 Say Handle 后，调用 VnController 的 triggerSayAnimation 方法触发打字机动画
        // 根据之前的开发计划，fullText 和 textDuration 应该在 handle.customData 中
        if (handle.performName === commandType[commandType.say] && handle.customData && typeof handle.customData.fullText === 'string') {
             const { fullText, textDuration } = handle.customData;
             // 确保 app.controller.vn 已经被初始化且可用，并且拥有 triggerSayAnimation 方法
             // 使用类型断言 (app.controller.vn as VnController) 来帮助 TypeScript 识别方法
             if (app.controller.vn && (app.controller.vn).triggerSayAnimation) {
                 // 调用 triggerSayAnimation，传递文本和时长
                 (app.controller.vn).triggerSayAnimation(fullText, textDuration);
                 this.logFunc(`触发 VnController 的 triggerSayAnimation，文本长度: ${fullText.length}, 时长: ${textDuration}ms`);
             } else {
                 this.warnFunc('app.controller.vn 或 triggerSayAnimation 未定义，无法触发打字机动画。');
             }
        // 新增：处理 Debug Handle 的文本显示
        } else if (handle.performName === 'debug' && handle.customData && typeof handle.customData.fullText === 'string' && typeof handle.customData.speaker === 'string') {
            const { fullText, speaker } = handle.customData;
            // 对于 Debug 命令，我们可能不需要打字机动画，只需要直接显示文本和说话者
            // 假设 VnController 有一个方法来直接设置对话文本和说话者
            // 如果没有，需要根据实际情况调整，例如直接操作 store 或查找其他 UI 方法
            // 这里我们尝试调用 triggerSayAnimation 来触发 UI 更新，并直接更新 store
            if (app.controller.vn && (app.controller.vn).triggerSayAnimation) {
                 // 调用 triggerSayAnimation， duration 设为 0 表示立即显示文本 (如果 UI 支持)
                (app.controller.vn).triggerSayAnimation(fullText, 0); // duration 设为 0 表示立即显示
                 // 直接更新 store 中的对话信息，UI 组件应该会响应 store 的变化
                 app.store.vn.setDialog(fullText);
                 app.store.vn.setSpeaker(speaker);
                 this.logFunc(`触发 VnController 显示 debug 文本并通过 store 更新，说话者: ${speaker}, 文本: ${fullText}`);
            } else {
                 this.warnFunc('app.controller.vn 或 triggerSayAnimation 未定义，无法显示 debug 文本。');
                 // 直接通过 store 更新 (后备方案，可能没有 UI 响应)
                 app.store.vn.setDialog(fullText);
                 app.store.vn.setSpeaker(speaker);
                 this.logFunc(`直接通过 store 显示 debug 文本 (无 VnController)，说话者: ${speaker}, 文本: ${fullText}`);
            }
        }
    }
    
    /**
     * 卸载表现 (标准API)
     * @param performName 表现名称
     */
    public unmountPerform(performName: string) {
        this.logFunc(`尝试卸载表现: ${performName}`);
        
        // 查找表现句柄
        const handle = this.activePerforms.get(performName);
        if (!handle) {
            this.warnFunc(`卸载表现失败: 未找到表现 ${performName}`);
            return;
        }
        
        // 清除定时器(如果存在)
        this._clearPerformTimer(performName);
        
        // 调用停止函数(如果存在)
        this._tryStopFunction(handle);
        
        // 从活跃表现中移除
        this.activePerforms.delete(performName);
        
        // 从Store中的表现列表移除
        app.store.vn.removePerform(performName);
        
        this.logFunc(`表现 ${performName} 已卸载, 剩余活跃表现数: ${this.activePerforms.size}`);
        
        // 如果需要在结束后继续执行下一句，则调用goNextWhenOver
        if (handle.goNextWhenOver) {
            this.logFunc(`表现 ${performName} 设置了goNextWhenOver=true, 尝试执行下一句`);
            this.goNextWhenOver();
        }
    }
    
    /**
     * 清除表现的定时器
     * @param performName 表现名称
     * @private
     */
    private _clearPerformTimer(performName: string) {
        const timerId = this.performTimers.get(performName);
        if (timerId !== undefined) {
            clearTimeout(timerId);
            this.performTimers.delete(performName);
            this.logFunc(`清除表现 ${performName} 的定时器: ${timerId}`);
        }
    }
    
    /**
     * 尝试调用表现的停止函数
     * @param handle 表现句柄
     * @private
     */
    private _tryStopFunction(handle: ICocosPerformHandle) {
        if (handle.stopFunction) {
            try {
                const result = handle.stopFunction(handle.performName, handle.customData);
                // 检查停止函数是否返回错误
                if (isVnCommandError(result)) {
                    this.errorFunc(`表现 ${handle.performName} 的停止函数执行错误: ${result.message}`, result.details);
                }
            } catch (e) {
                this.errorFunc(`表现 ${handle.performName} 的停止函数执行异常: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
    
    /**
     * 检查是否可以执行下一句
     * 当表现结束且goNextWhenOver=true时调用
     */
    public goNextWhenOver() {
        this.logFunc('检查是否可以执行下一句');
        
        // 遍历所有活跃表现，检查是否有阻塞
        for (const [performName, handle] of this.activePerforms.entries()) {
            // 调用blockingAuto检查是否阻塞
            if (handle.blockingAuto()) {
                this.logFunc(`表现 ${performName} 阻塞了自动播放，暂不执行下一句`);
                return;
            }
        }
        
        // 如果没有阻塞，则准备执行下一句
        this.logFunc('没有表现阻塞自动播放，准备执行下一句');
        this.nextSentenceFunc(); // 执行传入的回调函数
    }
    
    /**
     * 处理nextSentence中的表现清理
     * 返回是否处于allSettled状态
     */
    public processNextSentence(): { allSettled: boolean, isGoNext: boolean, performNamesToRemove: string[] } {
        // 检查是否处于演出完成状态
        // allSettled为True时，表示所有演出都满足: isHoldOn==true 或 skipNextCollect = true
        // 此时就不会清理任何演出，但是会从演出列表中移除skipNextCollect=true且isHoldOn=false的演出
        let allSettled = true;
        this.activePerforms.forEach(handle => {
            // 如果一个表现不是保持状态，并且不跳过回收，则认为未完成
            if (!handle.isHoldOn && !handle.skipNextCollect) {
                allSettled = false;
            }
        });
        
        if (allSettled) {
            // 所有普通演出已经结束 (或不存在非HoldOn且非skipNextCollect的演出)
            this.logFunc('所有普通演出已结束或不存在，准备执行下一句');
            
            // 清除状态表的演出序列: 只保留 isHoldOn 为 true 的项
            const performList = app.store.vn.getPerformList();
            // 只保留 isHoldOn 为 true 的项，将skipNextCollect=true的演出从列表中移除
            const newPerformList = performList.filter(p => p.isHoldOn);
            if (performList.length !== newPerformList.length) {
                 this.logFunc(`清理Store演出列表: ${performList.length} -> ${newPerformList.length}`);
                 app.store.vn.setPerformList(newPerformList);
            }
            
            // 返回allSettled=true，表示无需清理演出
            return { allSettled: true, isGoNext: false, performNamesToRemove: [] };
        }
        
        // 不处于allSettled状态 (存在非HoldOn且非skipNextCollect的演出) -> 用户点击强制结束
        this.logFunc('提前结束被触发，清除普通演出 (不调用unmountPerform)');
        let isGoNext = false;
        
        // 创建副本进行遍历和修改
        const performNamesToRemove: string[] = [];
        const performNames = Array.from(this.activePerforms.keys());
        
        for (const name of performNames) {
            const handle = this.activePerforms.get(name);
            // 只处理非保持状态且不跳过回收的表现
            if (handle && !handle.isHoldOn && !handle.skipNextCollect) {
                this.logFunc(`强制结束表现: ${name}`);
                
                // 记录是否需要继续下一句
                if (handle.goNextWhenOver) {
                    isGoNext = true;
                }
                
                // 手动执行清理步骤
                this._tryStopFunction(handle);
                this._clearPerformTimer(name);
                this.activePerforms.delete(name); // 直接从 Map 中移除
                performNamesToRemove.push(name); // 记录需要从 store 移除的名称
            }
        }
        
        // 从 Store 中批量移除
        if (performNamesToRemove.length > 0) {
            const currentStoreList = app.store.vn.getPerformList();
            // 使用 indexOf 替代 includes 以兼容旧版 JS 环境
            const updatedStoreList = currentStoreList.filter(p => performNamesToRemove.indexOf(p.performName) === -1);
            app.store.vn.setPerformList(updatedStoreList);
             this.logFunc(`批量从Store移除演出: ${performNamesToRemove.join(', ')}`);
        }
        
        this.logFunc(`强制结束后剩余活跃表现数: ${this.activePerforms.size}`);
        
        // 返回处理结果
        return { 
            allSettled: false, 
            isGoNext, 
            performNamesToRemove 
        };
    }
    
    /**
     * 检查是否有表现阻塞下一句
     */
    public hasBlockingNextPerform(): boolean {
        let isBlockingNext = false;
        this.activePerforms.forEach(handle => {
            if (handle.blockingNext()) {
                isBlockingNext = true;
            }
        });
        return isBlockingNext;
    }
} 