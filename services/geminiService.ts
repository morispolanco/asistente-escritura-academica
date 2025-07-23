
import { GoogleGenAI, Type, GenerateContentResponse, GroundingChunk } from "@google/genai";
import type { BookOutline } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const outlineSchema = {
    type: Type.OBJECT,
    properties: {
        titulo: { type: Type.STRING, description: "Título principal del libro." },
        introduccion: { 
            type: Type.OBJECT, 
            properties: { titulo: { type: Type.STRING } },
            required: ['titulo']
        },
        capitulos: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    titulo: { type: Type.STRING },
                    secciones: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['titulo', 'secciones']
            },
        },
        conclusion: { 
            type: Type.OBJECT, 
            properties: { titulo: { type: Type.STRING } },
            required: ['titulo']
        },
    },
    required: ['titulo', 'introduccion', 'capitulos', 'conclusion'],
};

export const generateBookOutline = async (article: string): Promise<BookOutline> => {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Basado en el siguiente artículo/tema, crea una estructura detallada para un libro académico de aproximadamente 25,000 palabras. El libro debe tener una introducción, una conclusión, y entre 5 y 8 capítulos principales. Cada capítulo debe estar dividido en 3 a 5 secciones lógicas. Aplica la regla de mayúscula inicial solo en la primera palabra y nombres propios para todos los títulos y subtítulos.
            
            Artículo/Tema:
            ${article}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: outlineSchema,
                systemInstruction: "Eres un experto editor y planificador de contenido académico. Tu tarea es estructurar un libro completo a partir de un tema o artículo inicial. Tu respuesta debe ser únicamente el objeto JSON solicitado, sin explicaciones adicionales."
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as BookOutline;
    } catch (error) {
        console.error("Error generating book outline:", error);
        throw new Error("No se pudo generar la estructura del libro. Por favor, revisa la consola para más detalles.");
    }
};

export const generateSectionContent = async (
    bookTopic: string,
    chapterTitle: string,
    sectionTitle: string
): Promise<{ texto: string; referencias: string[]; fuentes: GroundingChunk[] }> => {
    try {
        const wordsPerSection = 600; // Aim for this many words to reach ~25k total
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Escribe el contenido para la sección titulada "${sectionTitle}" dentro del capítulo "${chapterTitle}". El tema general del libro es "${bookTopic}". El texto de esta sección debe tener aproximadamente ${wordsPerSection} palabras. Investiga y utiliza fuentes académicas fiables (libros, artículos) usando la búsqueda de Google para respaldar TODAS las afirmaciones. Inserta citas en formato APA (Autor, Año) directamente en el texto donde sea necesario. Si incluyes diálogos, utiliza el guion largo (—). Al final del texto de esta sección, y claramente separado por '###REFERENCIAS###', crea una lista con las referencias completas en formato APA 7 de todas las fuentes que citaste.`,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: "Eres un escritor académico experto en investigación y redacción. Tu objetivo es escribir contenido de alta calidad, bien referenciado en formato APA 7."
            },
        });
        
        const content = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        const [texto, referenciasStr] = content.split('###REFERENCIAS###');
        
        const referencias = referenciasStr 
            ? referenciasStr.trim().split('\n').filter(ref => ref.trim() !== '') 
            : [];
            
        return { texto: texto.trim(), referencias, fuentes: groundingChunks };
    } catch (error) {
        console.error(`Error generating content for section "${sectionTitle}":`, error);
        throw new Error(`No se pudo generar el contenido para la sección "${sectionTitle}".`);
    }
};
