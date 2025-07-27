
export enum AppStep {
  Input,
  Outline,
  Generating,
  Review,
}

export interface Chapter {
  titulo: string;
  secciones: string[];
  contenido?: SectionContent[];
  referencias?: string[];
}

export interface SectionContent {
  titulo: string;
  texto: string;
  fuentes: GroundingChunk[];
}

export interface BookOutline {
  titulo: string;
  introduccion: { titulo: string };
  capitulos: Chapter[];
  conclusion: { titulo: string };
}

export interface GeneratedBook {
  titulo: string;
  introduccion: SectionContent & { referencias?: string[] };
  capitulos: Chapter[];
  conclusion: SectionContent & { referencias?: string[] };
  outputLanguage: string;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}