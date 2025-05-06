import { ISentence, arg, commandType } from '../../../../res-native/script/webGal/parser/interface/sceneInterface';
import { ICocosPerformHandle, VnCommandError } from '../vnTypes';
import { app } from '../../../../app/app';
import { Parser } from 'expr-eval/dist/index.mjs';

/**
 * 处理 setVar 命令
 * @param args 参数数组
 * @param sentence 原始语句对象
 * @returns 表现句柄或错误对象
 */
export function handleSetVar(args: arg[], sentence: ISentence): ICocosPerformHandle | VnCommandError {
    const assignment = sentence.content.trim();
    const parts = assignment.split('=');

    if (parts.length !== 2) {
        return {
            isError: true,
            message: `setVar 命令格式错误: 应该为 '变量名=表达式'`,
            command: commandType.setVar,
            details: { assignment }
        };
    }

    const variableName = parts[0].trim();
    const valuePart = parts[1].trim();

    if (!variableName) {
         return {
            isError: true,
            message: `setVar 命令格式错误: 变量名不能为空`, // 或者根据需要添加更多变量名有效性检查
            command: commandType.setVar,
            details: { assignment }
        };
    }

    let result: any;

    // 检查是否是 random() 函数
    if (valuePart === 'random()') {
        result = Math.random();
    } // 检查是否是布尔值
    else if (valuePart === 'true') {
        result = true;
    } else if (valuePart === 'false') {
        result = false;
    } // 检查是否是数字
    else if (!isNaN(Number(valuePart))) {
        result = Number(valuePart);
    } // 检查是否是包含运算符的表达式
    else if (valuePart.match(/[+\-*\/()><!]|>=|<=|==|&&|\|\||!=/)) {
         try {
            const parser = new Parser({ allowMemberAccess: false });
            // 添加 random() 函数支持到表达式求值器 (虽然上面已经单独处理了，这里保持一致)
            parser.functions.random = Math.random;

            // 创建求值上下文，包含当前已有的变量
            const context = { ...app.store.vn.gameVars };

            // 尝试求值
            result = parser.evaluate(valuePart, context);

        } catch (e: any) {
            // 表达式求值失败
            return {
                isError: true,
                message: `setVar 表达式求值错误: ${e.message}`,
                command: commandType.setVar,
                details: { assignment, error: e }
            };
        }
    } // 否则，视为字符串常量或变量引用
    else {
        // 尝试作为变量名获取其值
        const referencedVariableValue = app.store.vn.gameVars[valuePart];
        if (referencedVariableValue !== undefined) {
            result = referencedVariableValue; // 是一个已定义的变量名，使用其值
        } else {
            result = valuePart; // 不是变量名，视为字符串常量
        }
    }

    // 更新 Store 中的变量
    app.store.vn.setGameVar(variableName, result);

    console.log(`[setVar] Set ${variableName} = ${result}`); // 添加日志

    // 返回一个简单的、非阻塞的 perform handle
    return {
        performName: `setVar_${variableName}_${Date.now()}`, // 使用唯一名称
        duration: 0,
        goNextWhenOver: true,
        isHoldOn: false,
        blockingAuto: () => true,
        blockingNext: () => false,
        skipNextCollect: true, // setVar通常不需要被nextSentence清理
    };
} 