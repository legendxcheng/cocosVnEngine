/**
 * 定义 VnScript JSON 数据的结构接口
 */
interface VnScene {
    scene_name: string;
    wg_scripts: string;
}

interface WebGalScriptItem {
    wg_scenes: VnScene[];
}

interface VnScriptData {
    webgal_script: WebGalScriptItem[];
}

/**
 * VnScriptHelper 工具类
 * 用于方便地读取和操作 VnManager 中的 script JSON 数据。
 */
export class VnScriptHelper {
    /**
     * 存储从 script 数据中提取的所有场景。
     * @private
     * @readonly
     */
    private readonly scenes: VnScene[] = [];

    /**
     * 创建一个 VnScriptHelper 实例。
     * @param scriptData VnManager 中的 script 数据。
     */
    constructor(scriptData: VnScriptData) {
        // 基本有效性检查
        if (
            !scriptData ||
            !scriptData.webgal_script ||
            !Array.isArray(scriptData.webgal_script)
            // 不再检查 scriptData.webgal_script.length === 0，因为空数组是有效的
            // 不再检查 scriptData.webgal_script[0].wg_scenes，因为我们需要遍历
        ) {
            console.warn(
                'VnScriptHelper: 传入的 scriptData 或 scriptData.webgal_script 格式无效或为空，场景列表将为空。',
                scriptData
            );
            this.scenes = [];
        } else {
            // 提取并合并所有场景列表
            this.scenes = scriptData.webgal_script.reduce((acc, currentItem) => {
                if (currentItem && Array.isArray(currentItem.wg_scenes)) {
                    // 将当前项的场景列表合并到累加器中
                    return acc.concat(currentItem.wg_scenes);
                } else {
                    // 如果当前项的 wg_scenes 无效，则记录警告并跳过
                    console.warn(
                        'VnScriptHelper: webgal_script 中的某个元素缺少有效的 wg_scenes 数组。',
                        currentItem
                    );
                    return acc;
                }
            }, [] as VnScene[]); // 初始值为空的 VnScene 数组

            if (this.scenes.length === 0) {
                 console.warn(
                     'VnScriptHelper: 从 scriptData 中提取场景后，场景列表为空。',
                     scriptData
                 );
            }
        }
    }

    /**
     * 读取指定名称场景的 WebGAL 脚本。
     * @param sceneName 场景名称 (格式：X_Y)。
     * @returns 场景的 wg_scripts 字符串，如果未找到则返回 null。
     */
    public getSceneScript(sceneName: string): string | null {
        const scene = this.scenes.find((s) => s.scene_name === sceneName);
        return scene ? scene.wg_scripts : null;
    }

    /**
     * 读取指定名称场景的下一个默认场景的 WebGAL 脚本。
     * 查找顺序：
     * 1. 当前章节的下一个场景 (X_(Y+1))
     * 2. 下一章节的第一个场景 ((X+1)_1)
     * @param currentSceneName 当前场景名称 (格式：X_Y)。
     * @returns 下一个场景的 wg_scripts 字符串，如果未找到则返回 null。
     */
    public getDefaultNextSceneScript(currentSceneName: string): string | null {
        const parts = currentSceneName.split('_');
        if (parts.length !== 2) {
            console.warn(
                `VnScriptHelper.getDefaultNextSceneScript: 无效的场景名称格式: ${currentSceneName}。应为 X_Y。`
            );
            return null;
        }

        const chapterIdStr = parts[0];
        const sceneIdStr = parts[1];
        const chapterId = parseInt(chapterIdStr, 10);
        const sceneId = parseInt(sceneIdStr, 10);

        if (isNaN(chapterId) || isNaN(sceneId)) {
            console.warn(
                `VnScriptHelper.getDefaultNextSceneScript: 无法将场景名称解析为数字: ${currentSceneName}`
            );
            return null;
        }

        // 1. 查找同章节下一个场景 (X_(Y+1))
        const nextSceneInChapterName = `${chapterId}_${sceneId + 1}`;
        const nextScriptInChapter = this.getSceneScript(nextSceneInChapterName);
        if (nextScriptInChapter !== null) {
            return nextScriptInChapter;
        }

        // 2. 查找下一章节第一个场景 ((X+1)_1)
        const firstSceneNextChapterName = `${chapterId + 1}_1`;
        const firstScriptNextChapter = this.getSceneScript(
            firstSceneNextChapterName
        );
        return firstScriptNextChapter; // 返回找到的脚本或 null
    }
}
