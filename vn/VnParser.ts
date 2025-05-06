import { _decorator } from 'cc';
import SceneParser from '../../../../assets/res-native/script/webGal/parser/index';
import { ADD_NEXT_ARG_LIST, SCRIPT_CONFIG } from '../../../../assets/res-native/script/webGal/parser/config/scriptConfig';
import { fileType } from '../../../../assets/res-native/script/webGal/parser/interface/assets';
import { IAsset, IScene } from '../../../../assets/res-native/script/webGal/parser/interface/sceneInterface';
import { sceneTextPreProcess } from '../../../../assets/res-native/script/webGal/parser/sceneTextPreProcessor';

const { ccclass, property } = _decorator;

@ccclass('VnParser')
export class VnParser {
    private parser: SceneParser;
    
    constructor() {
        // 创建空的资源加载函数
        const assetsPrefetcher = (assetList: IAsset[]) => {
            console.log('[VnParser] 资源预获取请求:', assetList);
            // 暂不实际加载资源
        };
        
        // 创建简单的资源路径转换函数
        const assetSetter = (fileName: string, assetType: fileType) => {
            console.log('[VnParser] 资源路径转换:', fileName, assetType);
            return fileName; // 简单返回原文件名
        };
        
        // 初始化解析器
        this.parser = new SceneParser(
            assetsPrefetcher,
            assetSetter,
            ADD_NEXT_ARG_LIST,
            SCRIPT_CONFIG
        );
    }
    
    /**
     * 解析WebGAL场景文本
     * @param rawScene 原始场景文本
     * @param sceneName 场景名称
     * @param sceneUrl 场景URL
     * @returns 解析后的场景对象
     */
    public parseScene(rawScene: string, sceneName: string, sceneUrl: string): IScene {
        return this.parser.parse(rawScene, sceneName, sceneUrl);
    }
    
    /**
     * 解析WebGAL配置文本
     * @param configText 配置文本
     * @returns 解析后的配置对象
     */
    public parseConfig(configText: string) {
        return this.parser.parseConfig(configText);
    }
    
    /**
     * 预处理场景文本
     * @param sceneText 场景文本
     * @returns 预处理后的场景文本
     */
    public preProcessSceneText(sceneText: string): string {
        return sceneTextPreProcess(sceneText);
    }
} 