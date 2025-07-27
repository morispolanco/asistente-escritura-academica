
import { GoogleGenAI, Type, GenerateContentResponse, GroundingChunk } from "@google/genai";
import type { BookOutline } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanGeneratedText = (text: string, title: string): string => {
    const trimmedText = text.trim();
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
        return trimmedText;
    }

    const escapedTitle = trimmedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titlePattern = new RegExp(`^((#+\\s*${escapedTitle})|(${escapedTitle}))\\s*\\n?`, 'i');
    
    return trimmedText.replace(titlePattern, '').trim();
};

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
    wordCountTarget: number,
    outputLanguage: string,
    fileContent: string
): Promise<BookOutline> => {
    const isEnglish = outputLanguage === 'en';

    const langInstructions = {
        mainPrompt: isEnglish 
            ? `Create a detailed book outline based on the following topic/article. The entire response, including all titles and sections, must be in English.`
            : `Crea una estructura detallada para un libro basado en el siguiente artículo/tema. Toda la respuesta, incluyendo títulos y secciones, debe estar en español.`,
        publicationParams: isEnglish ? `**Publication Parameters:**` : `**Parámetros de la publicación:**`,
        type: isEnglish ? `- **Type:**` : `- **Tipo:**`,
        tone: isEnglish ? `- **Tone:**` : `- **Tono:**`,
        audience: isEnglish ? `- **Target Audience:**` : `- **Público Objetivo:**`,
        mainTopic: isEnglish ? `- **Main Topic:**` : `- **Tema principal:**`,
        baseMaterial: isEnglish ? `**Base material provided by user (use this as the primary source):**` : `**Material de base proporcionado por el usuario (usa esto como fuente principal):**`,
        structureRequirements: isEnglish ? `**Structure Requirements:**` : `**Requisitos de la estructura:**`,
        wordCount: isEnglish 
            ? `- The book should have an approximate length of ${wordCountTarget.toLocaleString('en-US')} words.`
            : `- El libro debe tener una extensión aproximada de ${wordCountTarget.toLocaleString('es-ES')} palabras.`,
        chapters: isEnglish 
            ? `- It must include an introduction, a conclusion, and ${numChapters} main chapters.`
            : `- Debe incluir una introducción, una conclusión y ${numChapters} capítulos principales.`,
        sections: isEnglish 
            ? `- Each chapter should be divided into 3 to 5 logical sections.`
            : `- Cada capítulo debe estar dividido en 3 a 5 secciones lógicas.`,
        casing: isEnglish 
            ? `- For all titles and subtitles, use title case (capitalize the first letter of each major word).` 
            : `- Aplica la regla de mayúscula inicial solo en la primera palabra y nombres propios para todos los títulos y subtítulos.`,
        systemInstruction: isEnglish
            ? "You are an expert editor and content planner. Your task is to structure a complete book from a topic and specific parameters. Your response must be solely the requested JSON object, with no additional explanations."
            : "Eres un experto editor y planificador de contenido. Tu tarea es estructurar un libro completo a partir de un tema y unos parámetros específicos. Tu respuesta debe ser únicamente el objeto JSON solicitado, sin explicaciones adicionales."
    };

    const prompt = `
${langInstructions.mainPrompt}
${fileContent ? `\n${langInstructions.baseMaterial}\n${fileContent}\n` : ''}
${langInstructions.publicationParams}
${langInstructions.type} ${publicationType}
${langInstructions.tone} ${tone}
${langInstructions.audience} ${audience}
${langInstructions.mainTopic} ${article}

${langInstructions.structureRequirements}
${langInstructions.wordCount}
${langInstructions.chapters}
${langInstructions.sections}
${langInstructions.casing}
    `.trim();

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: outlineSchema,
                systemInstruction: langInstructions.systemInstruction
            },
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as BookOutline;
    } catch (error) {
        console.error("Error generating book outline:", error);
        const errorMessage = isEnglish ? "Could not generate the book outline. Please check the console for more details." : "No se pudo generar la estructura del libro. Por favor, revisa la consola para más detalles.";
        throw new Error(errorMessage);
    }
};

export const generateSectionContent = async (
    bookTopic: string,
    chapterTitle: string,
    sectionTitle: string,
    publicationType: string, 
    tone: string, 
    audience: string,
    wordsPerSection: number,
    outputLanguage: string,
    fileContent: string,
): Promise<{ texto: string; referencias: string[]; fuentes: GroundingChunk[] }> => {
    const isEnglish = outputLanguage === 'en';

    const langInstructions = {
        task: isEnglish
            ? "Your task is to write the content for a specific section of a book. The response must be in English."
            : "Tu tarea es escribir el contenido para una sección específica de un libro. La respuesta debe ser en español.",
        bookContext: isEnglish ? "**Book Context:**" : "**Contexto del libro:**",
        topic: isEnglish ? "- **Overall Topic:**" : "- **Tema general:**",
        pubType: isEnglish ? "- **Publication Type:**" : "- **Tipo de publicación:**",
        tone: isEnglish ? "- **Desired Tone:**" : "- **Tono deseado:**",
        audience: isEnglish ? "- **Target Audience:**" : "- **Público objetivo:**",
        baseMaterial: isEnglish ? "**Base material provided by user (use this as the primary source):**" : "**Material de base proporcionado por el usuario (usa esto como fuente principal):**",
        sectionToWrite: isEnglish ? "**Section to Write:**" : "**Sección a escribir:**",
        chapter: isEnglish ? "- **Chapter:**" : "- **Capítulo:**",
        section: isEnglish ? "- **Section:**" : "- **Sección:**",
        writingInstructions: isEnglish ? "**Writing Instructions:**" : "**Instrucciones de escritura:**",
        wordCount: isEnglish
            ? `- The text for this section should be approximately ${wordsPerSection} words.`
            : `- El texto de esta sección debe tener aproximadamente ${wordsPerSection} palabras.`,
        style: isEnglish
            ? `- Write with the appropriate tone and complexity for the defined publication type and audience. For 'academic' or 'technical' publications, use precise and well-structured language. For 'general dissemination', use more accessible language.`
            : `- Escribe con el tono y la complejidad adecuados para el tipo de publicación y el público definidos. Para publicaciones 'académica' o 'técnica', utiliza un lenguaje preciso y bien estructurado. Para 'difusión general', usa un lenguaje más accesible.`,
        searchInstruction: publicationType === 'académica'
            ? isEnglish
                ? `- Research and use reliable sources using exclusively Google Scholar to back up ALL claims. Prioritize peer-reviewed scientific articles, theses, and academic publications.`
                : `- Investiga y utiliza fuentes fiables usando exclusivamente Google Académico (Google Scholar) para respaldar TODAS las afirmaciones. Prioriza artículos científicos, tesis y publicaciones académicas revisadas por pares.`
            : isEnglish
                ? `- Research and use reliable sources using Google Search to back up ALL claims.`
                : `- Investiga y utiliza fuentes fiables usando la búsqueda de Google para respaldar TODAS las afirmaciones.`,
        citations: isEnglish
            ? `- Insert citations in APA (Author, Year) format directly in the text where necessary.`
            : `- Inserta citas en formato APA (Autor, Año) directamente en el texto donde sea necesario.`,
        dialogue: isEnglish
            ? `- If you include dialogue, use em dashes (—).`
            : `- Si incluyes diálogos, utiliza el guion largo (—).`,
        references: isEnglish
            ? `- At the end of the text for this section, and clearly separated by '###REFERENCES###', create a list with the full references in APA 7 format for all the sources you cited.`
            : `- Al final del texto de esta sección, y claramente separado por '###REFERENCIAS###', crea una lista con las referencias completas en formato APA 7 de todas las fuentes que citaste.`,
        systemInstruction: isEnglish 
            ? "You are an expert academic writer specializing in research and composition. Your goal is to write high-quality, well-referenced content in APA 7 format, adapting your style to the specified parameters. Prioritize information from the user-provided base material if available."
            : "Eres un escritor académico experto en investigación y redacción. Tu objetivo es escribir contenido de alta calidad, bien referenciado en formato APA 7, adaptando tu estilo a los parámetros especificados. Prioriza la información del material de base proporcionado por el usuario si está disponible."
    };
    
    const referenceSeparator = isEnglish ? '###REFERENCES###' : '###REFERENCIAS###';

    const prompt = `
${langInstructions.task}

${langInstructions.bookContext}
${langInstructions.topic} "${bookTopic}"
${langInstructions.pubType} ${publicationType}
${langInstructions.tone} ${tone}
${langInstructions.audience} ${audience}
${fileContent ? `\n${langInstructions.baseMaterial}\n${fileContent}\n` : ''}

${langInstructions.sectionToWrite}
${langInstructions.chapter} "${chapterTitle}"
${langInstructions.section} "${sectionTitle}"

${langInstructions.writingInstructions}
${langInstructions.wordCount}
${langInstructions.style}
${langInstructions.searchInstruction}
${langInstructions.citations}
${langInstructions.dialogue}
${langInstructions.references}
    `.trim();

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: langInstructions.systemInstruction,
            },
        });
        
        const content = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        const [rawTexto, referenciasStr] = content.split(referenceSeparator);
        
        const textoLimpio = cleanGeneratedText(rawTexto, sectionTitle);

        const referencias = referenciasStr 
            ? referenciasStr.trim().split('\n').filter(ref => ref.trim() !== '') 
            : [];
            
        return { texto: textoLimpio, referencias, fuentes: groundingChunks };
    } catch (error) {
        console.error(`Error generating content for section "${sectionTitle}":`, error);
        const errorMessage = isEnglish 
            ? `Could not generate content for section "${sectionTitle}".`
            : `No se pudo generar el contenido para la sección "${sectionTitle}".`;
        throw new Error(errorMessage);
    }
};
