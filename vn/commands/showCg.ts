import { ISentence, commandType } from '../../../../../assets/res-native/script/webGal/parser/interface/sceneInterface';
import { ICocosPerformHandle, VnCommandError, WEBGAL_NONE, isVnCommandError } from '../vnTypes';
import { app } from '../../../../app/app';

/**
 * 处理showCg命令
 * @param args 参数数组
 * @param sentence 原始语句对象
 * @returns 表现句柄或错误对象
 */
export const handleShowCg = (args: any[], sentence: ISentence): ICocosPerformHandle | VnCommandError => {
    // 从语句内容中获取CG路径
    const cgPath = sentence.content?.trim();
    
    // 检查路径是否存在
    if (cgPath === null) {
        return {
            isError: true,
            message: 'showCg命令缺少参数',
            command: commandType.showCg,
            details: { sentence }
        };
    }
    
    // 更新store中的CG状态
    app.store.vn.setCg(!cgPath? null : cgPath);
    
    // 返回表现句柄
    return {
        performName: `changeCg`,
        duration: 0, // 状态变更瞬间完成
        goNextWhenOver: true, // 允许继续执行下一句
        isHoldOn: false, // 不需要保持，状态由store控制
        blockingAuto: () => true,
        blockingNext: () => false,
    };
}; 