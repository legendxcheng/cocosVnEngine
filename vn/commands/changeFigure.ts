import { ISentence, arg } from '../../../../res-native/script/webGal/parser/interface/sceneInterface';
import { ICocosPerformHandle, VnCommandError, WEBGAL_NONE } from '../vnTypes';
import { app } from "db://assets/app/app"; // Import app using db:// path

// Assuming app is available globally or via framework injection
// import { app } from '../../../app/app'; 
// assetSetter and fileType are not needed in the command handler
// import { assetSetter, fileType } from '@/Core/util/gameAssetsAccess/assetSetter';

export const handlechangeFigureCommand = (args: any[], sentence: ISentence): ICocosPerformHandle | VnCommandError => {
  let pos: 'center' | 'left' | 'right' = 'center';
  let resourcePath: string | undefined = sentence.content;
  let goNext = false;

  // Parse arguments
  for (const e of sentence.args) {
    switch (e.key) {
      case 'left':
        if (e.value === true) pos = 'left';
        break;
      case 'right':
        if (e.value === true) pos = 'right';
        break;
      case 'center': // Handle -center explicitly if needed, though it's the default
        if (e.value === true) pos = 'center';
        break;
      case 'clear':
      case 'none':
        if (e.value === true) resourcePath = undefined; // Use undefined to signify clearing
        break;
      case 'next':
        if (e.value === true) goNext = true;
        break;
      // Ignoring other args like id, motion, expression, etc. for now as per plan
      default:
        break;
    }
  }

  const targetFigureKey = `fig-${pos}`; // e.g., 'fig-center'

  // Update the store based on the parsed position and resource path
  console.log(`Updating store for position: ${pos} with resource: ${resourcePath}`);
  try {
    switch (pos) {
      case 'left':
        // Store the raw resourcePath directly
        app.store.vn.setFigureLeft(resourcePath ?? null);
        break;
      case 'center':
        // Store the raw resourcePath directly
        app.store.vn.setFigureCenter(resourcePath ?? null);
        break;
      case 'right':
        // Store the raw resourcePath directly
        app.store.vn.setFigureRight(resourcePath ?? null);
        break;
    }
  } catch (error: any) {
    return {
      isError: true,
      message: `Error updating VN store: ${error.message || error}`,
      details: error
    };
  }

  // Returning a handle that finishes immediately and triggers next sentence if -next is present
  return {
    performName: "igure_chagne",
    duration: 0,
    goNextWhenOver: goNext,
    isHoldOn: false,
    blockingAuto: () => false,
    blockingNext: () => false,
    skipNextCollect: true
  };
}

// Note: Resource loading and view updates will be handled in PageVn.ts based on store changes. 