
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
}

export interface SectionContent {
  titulo: string;
  texto: string;
  referencias: string[];
  fuentes?: GroundingChunk[];
}

export interface BookOutline {
  titulo: string;
  introduccion: { titulo: string };
  capitulos: Chapter[];
  conclusion: { titulo: string };
}

export interface GeneratedBook {
  titulo: string;
  introduccion: SectionContent;
  capitulos: Chapter[];
  conclusion: SectionContent;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}
