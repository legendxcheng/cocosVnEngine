import {
  arg,
  commandType,
  IAsset,
  ISentence,
} from '../interface/sceneInterface';
import { argsParser } from './argsParser';
import { contentParser } from './contentParser';
import { assetsScanner } from './assetsScanner';
import { subSceneScanner } from './subSceneScanner';
import { ConfigMap } from '../config/scriptConfig';

/**
 * 语句解析器
 * @param sentenceRaw 原始语句
 * @param assetSetter
 * @param ADD_NEXT_ARG_LIST
 * @param SCRIPT_CONFIG_MAP
 */
export const scriptParser = (
  sentenceRaw: string,
  assetSetter: any,
  ADD_NEXT_ARG_LIST: commandType[],
  SCRIPT_CONFIG_MAP: ConfigMap,
): ISentence => {
  let determinedCommandType: commandType;
  let speaker: string | undefined = undefined;
  let commandPartRaw: string = ''; // Original part before colon

  // 去分号
  let sentenceWithoutTrailingSemicolon = sentenceRaw.split(/(?<!\\);/)[0];
  sentenceWithoutTrailingSemicolon = sentenceWithoutTrailingSemicolon.replace('\\;', ';');

  if (sentenceWithoutTrailingSemicolon.trim() === '') {
    // 注释提前返回
    return {
      command: commandType.comment, // 语句类型
      commandRaw: sentenceRaw.trim(), // 原始行 trimmed
      content: sentenceRaw.split(';')[1] ? sentenceRaw.split(';')[1].trim() : '', // 内容是第一个分号后的部分
      args: [], // 参数列表
      sentenceAssets: [], // 语句携带的资源列表
      subScene: [], // 语句携带的子场景
    };
  }

  let processingSentence = sentenceWithoutTrailingSemicolon;
  let contentArgsPart: string;

  // 尝试通过第一个冒号拆分命令和内容/参数部分
  const colonMatch = /:/.exec(processingSentence);

  if (colonMatch === null) {
    // 没有找到冒号，视为纯文本 say 命令
    determinedCommandType = commandType.say;
    speaker = undefined; // No explicit speaker
    commandPartRaw = ''; // No command part before colon
    contentArgsPart = processingSentence; // Entire line is content/args
  } else {
    // 找到冒号
    commandPartRaw = processingSentence.substring(0, colonMatch.index).trim();
    contentArgsPart = processingSentence.substring(colonMatch.index + 1);

    // 根据 commandPart 确定命令类型和说话者
    if (commandPartRaw === '') {
      // 冒号前为空，视为旁白 (:对话;)
      determinedCommandType = commandType.say;
      speaker = undefined; // No explicit speaker
    } else {
      // 冒号前不为空，检查是否为已知命令
      if (SCRIPT_CONFIG_MAP.has(commandPartRaw)) {
        // 是已知命令
        determinedCommandType = SCRIPT_CONFIG_MAP.get(commandPartRaw)!.scriptType;
        speaker = undefined; // 已知命令没有说话者概念
      } else {
        // 不是已知命令，视为带说话者的 say 命令 (角色:对话;)
        determinedCommandType = commandType.say;
        speaker = commandPartRaw;
      }
    }
  }

  // 尝试通过第一个 ' -' 拆分内容和参数部分
  const argsMatch = / -/.exec(contentArgsPart);
  let finalContent: string;
  let argsRaw: string;
  const args: Array<arg> = [];

  if (argsMatch === null) {
    // 没有找到参数分隔符
    finalContent = contentArgsPart;
    argsRaw = '';
  } else {
    // 找到参数分隔符
    finalContent = contentArgsPart.substring(0, argsMatch.index);
    argsRaw = contentArgsPart.substring(argsMatch.index);
  }

  // 解析参数
  if (argsRaw) {
    for (const e of argsParser(argsRaw, assetSetter)) {
      args.push(e);
    }
  }

  // 如果是 Say 命令且有说话者，将说话者作为参数添加 (避免重复添加)
  if (determinedCommandType === commandType.say && speaker !== undefined) {
      if (!args.some(arg => arg.key === 'speaker')) {
           args.push({ key: 'speaker', value: speaker });
      }
  }

  // 添加 next 参数 (如果需要)
  if (ADD_NEXT_ARG_LIST.indexOf(determinedCommandType) !== -1) {
      // Check if 'next' arg already exists before pushing
      if (!args.some(arg => arg.key === 'next')) {
          args.push({
              key: 'next',
              value: true,
          });
      }
  }

  const content = contentParser(finalContent.trim(), determinedCommandType, assetSetter); // 将语句内容里的文件名转为相对或绝对路径
  const sentenceAssets = assetsScanner(determinedCommandType, content, args); // 扫描语句携带资源
  const subScene = subSceneScanner(determinedCommandType, content); // 扫描语句携带子场景

  return {
    command: determinedCommandType, // 使用确定后的命令类型
    commandRaw: colonMatch === null ? processingSentence.trim() : commandPartRaw, // 原始命令部分 (冒号前内容) 或整行 trimmed
    content: content, // 处理后的语句内容
    args: args, // 参数列表 (包含说话者)
    sentenceAssets: sentenceAssets, // 语句携带的资源列表
    subScene: subScene, // 语句携带的子场景
  };
};
