import baseRaw from '../pm121/film.json';
import presentationRaw from '../pm123/presentation.json';
import {validateEngine,type EngineFilm} from '../pm121/lib/engine';
import {validatePresentation,presentFilm} from '../pm123/presentation';
const base=validateEngine(baseRaw);
export const recordedFilm=validateEngine(presentFilm(base,validatePresentation(presentationRaw,base)));
/** Fixed replay: refuse receipt attribution for a different (even valid) film. */
export function isRecordedFilm(film:EngineFilm){try{return JSON.stringify(validateEngine(film))===JSON.stringify(recordedFilm);}catch{return false;}}
export function assertRecordedFilm(film:EngineFilm){if(!isRecordedFilm(film))throw Error('Recorded film mismatch; do not reuse its provenance');}
