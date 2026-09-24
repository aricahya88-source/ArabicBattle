import { STUDENT_ROOM } from './studentRoom';
import { KITCHEN } from './kitchen';
import type { WorldCard, WorldConfig } from './types';

export const PLAYABLE_WORLDS:Record<string,WorldConfig>={
  [STUDENT_ROOM.id]:STUDENT_ROOM,
  [KITCHEN.id]:KITCHEN
};
export const WORLD_CARDS:WorldCard[]=[
  {id:'student-room',name:'Student Room',arabic:'غُرْفَةُ الطَّالِبِ',description:'Bedroom and study vocabulary.',emoji:'🛏️📚💡',status:'published',vocabularyCount:25,difficulty:'Easy–Hard'},
  {id:'kitchen',name:'Kitchen',arabic:'الْمَطْبَخُ',description:'Food, utensils, appliances and spatial relations.',emoji:'🍳🥣🍎',status:'published',vocabularyCount:28,difficulty:'Easy–Hard'},
  {id:'classroom',name:'Classroom',arabic:'الْفَصْلُ الدِّرَاسِيُّ',description:'School objects and classroom actions.',emoji:'🏫📚✏️',status:'coming-soon',vocabularyCount:0,difficulty:'Coming Soon'},
  {id:'market',name:'Market',arabic:'السُّوقُ',description:'Shopping, numbers, food and transactions.',emoji:'🛒🥕💰',status:'coming-soon',vocabularyCount:0,difficulty:'Coming Soon'},
  {id:'library',name:'Library',arabic:'الْمَكْتَبَةُ',description:'Books, locations and study expressions.',emoji:'📚🔖🪑',status:'coming-soon',vocabularyCount:0,difficulty:'Coming Soon'},
  {id:'hospital',name:'Hospital',arabic:'الْمُسْتَشْفَى',description:'Healthcare places and common objects.',emoji:'🏥🩺💊',status:'coming-soon',vocabularyCount:0,difficulty:'Coming Soon'},
  {id:'airport',name:'Airport',arabic:'الْمَطَارُ',description:'Travel, directions and transportation.',emoji:'✈️🧳🛂',status:'coming-soon',vocabularyCount:0,difficulty:'Coming Soon'},
  {id:'park',name:'Park',arabic:'الْحَدِيقَةُ',description:'Nature, movement and outdoor vocabulary.',emoji:'🌳⚽🛝',status:'coming-soon',vocabularyCount:0,difficulty:'Coming Soon'}
];
export function getWorld(id:string|undefined|null){return PLAYABLE_WORLDS[id||'student-room']||STUDENT_ROOM}
export function getWorldCard(id:string|undefined|null){return WORLD_CARDS.find(w=>w.id===id)||WORLD_CARDS[0]}
