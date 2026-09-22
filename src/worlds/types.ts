import type { Difficulty, Relation } from '../data/vocabulary';
export type ShapeType = 'box'|'sphere'|'cylinder'|'cone';
export interface SceneObjectDef {
  id: string; vocabId?: string; name: string; shape: ShapeType;
  pos: [number,number,number]; scale: [number,number,number]; color: string;
  rotation?: [number,number,number]; interactive?: boolean; relation?: Relation;
  relationTarget?: string; hidden?: boolean; emissive?: string; opacity?: number;
}
export interface WorldConfig {
  id: string; name: string; arabic: string; description: string; arScale: number;
  difficulty: Difficulty; objects: SceneObjectDef[];
}
