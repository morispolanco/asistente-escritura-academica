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

export const generateBookOutline = async (
    article: string, 
    publicationType: string, 
    tone: string, 
    audience: string,
    numChapters: number,
    wordCountTarget: number
): Promise<BookOutline> => {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Crea una estructura detallada para un libro basado en el siguiente artículo/tema.

**Parámetros de la publicación:**
- **Tipo:** ${publicationType}
- **Tono:** ${tone}
- **Público Objetivo:** ${audience}
- **Tema principal:** ${article}

**Requisitos de la estructura:**
- El libro debe tener una extensión aproximada de ${wordCountTarget.toLocaleString('es-ES')} palabras.
- Debe incluir una introducción, una conclusión y ${numChapters} capítulos principales.
- Cada capítulo debe estar dividido en 3 a 5 secciones lógicas.
- Aplica la regla de mayúscula inicial solo en la primera palabra y nombres propios para todos los títulos y subtítulos.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: outlineSchema,
                systemInstruction: "Eres un experto editor y planificador de contenido. Tu tarea es estructurar un libro completo a partir de un tema y unos parámetros específicos. Tu respuesta debe ser únicamente el objeto JSON solicitado, sin explicaciones adicionales."
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
    sectionTitle: string,
    publicationType: string, 
    tone: string, 
    audience: string,
    wordsPerSection: number
): Promise<{ texto: string; referencias: string[]; fuentes: GroundingChunk[] }> => {
    try {
        const searchInstruction = publicationType === 'académica'
            ? "Investiga y utiliza fuentes fiables usando exclusivamente Google Académico (Google Scholar) para respaldar TODAS las afirmaciones. Prioriza artículos científicos, tesis y publicaciones académicas revisadas por pares."
            : "Investiga y utiliza fuentes fiables usando la búsqueda de Google para respaldar TODAS las afirmaciones.";

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Tu tarea es escribir el contenido para una sección específica de un libro.

**Contexto del libro:**
- **Tema general:** "${bookTopic}"
- **Tipo de publicación:** ${publicationType}
- **Tono deseado:** ${tone}
- **Público objetivo:** ${audience}

**Sección a escribir:**
- **Capítulo:** "${chapterTitle}"
- **Sección:** "${sectionTitle}"

**Instrucciones de escritura:**
- El texto de esta sección debe tener aproximadamente ${wordsPerSection} palabras.
- Escribe con el tono y la complejidad adecuados para el tipo de publicación y el público definidos. Para publicaciones 'académica' o 'técnica', utiliza un lenguaje preciso y bien estructurado. Para 'difusión general', usa un lenguaje más accesible.
- ${searchInstruction}
- Inserta citas en formato APA (Autor, Año) directamente en el texto donde sea necesario.
- Si incluyes diálogos, utiliza el guion largo (—).
- Al final del texto de esta sección, y claramente separado por '###REFERENCIAS###', crea una lista con las referencias completas en formato APA 7 de todas las fuentes que citaste.`,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: "Eres un escritor académico experto en investigación y redacción. Tu objetivo es escribir contenido de alta calidad, bien referenciado en formato APA 7, adaptando tu estilo a los parámetros especificados."
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