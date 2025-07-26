
import React, { useState, useCallback } from 'react';
import { AppStep } from './types';
import type { BookOutline, GeneratedBook, SectionContent, Chapter, GroundingChunk } from './types';
import { generateBookOutline, generateSectionContent } from './services/geminiService';
import { exportToDocx } from './services/docxService';
import { Icon } from './components/Icon';

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
    <div className="w-full bg-brand-light rounded-full h-2.5">
        <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
    </div>
);

const App: React.FC = () => {
    const [step, setStep] = useState<AppStep>(AppStep.Input);
    const [userInput, setUserInput] = useState<string>('');
    const [publicationType, setPublicationType] = useState<string>('académica');
    const [tone, setTone] = useState<string>('formal');
    const [audience, setAudience] = useState<string>('profesionales');
    const [numChapters, setNumChapters] = useState<number>(7);
    const [wordCountTarget, setWordCountTarget] = useState<number>(25000);
    const [bookOutline, setBookOutline] = useState<BookOutline | null>(null);
    const [generatedBook, setGeneratedBook] = useState<GeneratedBook | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [progress, setProgress] = useState(0);
    const [currentTask, setCurrentTask] = useState('');
    const [wordCount, setWordCount] = useState(0);

    const handleGenerateOutline = async () => {
        if (!userInput.trim()) {
            setError('Por favor, introduce un tema o un artículo.');
            return;
        }
        setIsLoading(true);
        setError('');
        setCurrentTask('Generando estructura del libro...');
        setProgress(5);
        try {
            const outline = await generateBookOutline(userInput, publicationType, tone, audience, numChapters, wordCountTarget);
            setBookOutline(outline);
            setStep(AppStep.Outline);
        } catch (e: any) {
            setError(e.message || 'Ocurrió un error desconocido.');
        } finally {
            setIsLoading(false);
            setProgress(0);
            setCurrentTask('');
        }
    };

    const countWords = (text: string): number => {
        return text.trim().split(/\s+/).length;
    };

    const handleGenerateBook = useCallback(async () => {
        if (!bookOutline) return;

        setIsLoading(true);
        setError('');
        setStep(AppStep.Generating);
        let accumulatedBook: GeneratedBook = {
            titulo: bookOutline.titulo,
            introduccion: { titulo: bookOutline.introduccion.titulo, texto: '', referencias: [], fuentes: [] },
            capitulos: bookOutline.capitulos.map(c => ({ ...c, contenido: [] })),
            conclusion: { titulo: bookOutline.conclusion.titulo, texto: '', referencias: [], fuentes: [] },
        };
        
        let totalWords = 0;
        setWordCount(0);

        const totalSections = bookOutline.capitulos.reduce((acc, chap) => acc + chap.secciones.length, 0) + 2; // + intro & conclusion
        const wordsPerSection = totalSections > 0 ? Math.round(wordCountTarget / totalSections) : 0;
        let sectionsCompleted = 0;

        try {
            // Generate Introduction
            setCurrentTask(`Escribiendo introducción: ${bookOutline.introduccion.titulo}`);
            const introContent = await generateSectionContent(bookOutline.titulo, "Introducción", bookOutline.introduccion.titulo, publicationType, tone, audience, wordsPerSection);
            accumulatedBook.introduccion = { ...accumulatedBook.introduccion, ...introContent };
            totalWords += countWords(introContent.texto);
            setWordCount(totalWords);
            sectionsCompleted++;
            setProgress((sectionsCompleted / totalSections) * 100);
            setGeneratedBook({...accumulatedBook});

            // Generate Chapters
            for (let i = 0; i < bookOutline.capitulos.length; i++) {
                const chapter = bookOutline.capitulos[i];
                const newChapterContent: SectionContent[] = [];
                for (let j = 0; j < chapter.secciones.length; j++) {
                    const sectionTitle = chapter.secciones[j];
                    setCurrentTask(`Capítulo ${i + 1}/${bookOutline.capitulos.length}: Escribiendo sección "${sectionTitle}"`);
                    const sectionContent = await generateSectionContent(bookOutline.titulo, chapter.titulo, sectionTitle, publicationType, tone, audience, wordsPerSection);
                    newChapterContent.push({ ...sectionContent, titulo: sectionTitle });
                    totalWords += countWords(sectionContent.texto);
                    setWordCount(totalWords);
                    sectionsCompleted++;
                    setProgress((sectionsCompleted / totalSections) * 100);
                    
                    accumulatedBook.capitulos[i].contenido = newChapterContent;
                    setGeneratedBook({...accumulatedBook});
                }
            }

            // Generate Conclusion
            setCurrentTask(`Escribiendo conclusión: ${bookOutline.conclusion.titulo}`);
            const conclusionContent = await generateSectionContent(bookOutline.titulo, "Conclusión", bookOutline.conclusion.titulo, publicationType, tone, audience, wordsPerSection);
            accumulatedBook.conclusion = { ...accumulatedBook.conclusion, ...conclusionContent };
            totalWords += countWords(conclusionContent.texto);
            setWordCount(totalWords);
            sectionsCompleted++;
            setProgress(100);

            setGeneratedBook(accumulatedBook);
            setStep(AppStep.Review);

        } catch (e: any) {
            setError(e.message || 'Ocurrió un error durante la generación del libro.');
            setStep(AppStep.Outline); // Go back to outline if fails
        } finally {
            setIsLoading(false);
            setCurrentTask('');
        }
    }, [bookOutline, publicationType, tone, audience, wordCountTarget]);

    const handleExport = () => {
        if (generatedBook) {
            exportToDocx(generatedBook);
        }
    };

    const renderHeader = () => (
        <header className="bg-brand-primary p-4 shadow-md">
            <div className="container mx-auto flex items-center justify-center">
                <Icon name="book" className="w-8 h-8 text-white mr-3" />
                <h1 className="text-2xl font-bold text-white">Asistente de Escritura Académica</h1>
            </div>
        </header>
    );

    const renderInputStep = () => (
        <div className="w-full max-w-3xl">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">Paso 1: Configura tu libro</h2>
            <p className="text-text-secondary mb-4">Define el tema, estilo y público para generar un borrador a tu medida.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                    <label htmlFor="publicationType" className="block text-sm font-medium text-text-secondary mb-1">Tipo de publicación</label>
                    <select
                        id="publicationType"
                        value={publicationType}
                        onChange={(e) => setPublicationType(e.target.value)}
                        disabled={isLoading}
                        className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition bg-white"
                    >
                        <option value="académica">Académica</option>
                        <option value="difusión general">Difusión General</option>
                        <option value="técnica">Técnica</option>
                        <option value="tutorial">Tutorial</option>
                        <option value="libro de casos">Libro de Casos</option>
                        <option value="cuaderno de ejercicios">Cuaderno de Ejercicios</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="tone" className="block text-sm font-medium text-text-secondary mb-1">Tono</label>
                    <select
                        id="tone"
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        disabled={isLoading}
                        className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition bg-white"
                    >
                        <option value="formal">Formal</option>
                        <option value="profesional">Profesional</option>
                        <option value="informal">Informal</option>
                    </select>
                </div>
                 <div>
                    <label htmlFor="audience" className="block text-sm font-medium text-text-secondary mb-1">Público objetivo</label>
                    <select
                        id="audience"
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        disabled={isLoading}
                        className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition bg-white"
                    >
                        <option value="profesionales">Profesionales</option>
                        <option value="general">General</option>
                        <option value="adultos">Adultos</option>
                        <option value="jóvenes">Jóvenes</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6">
                <div>
                    <label htmlFor="numChapters" className="block text-sm font-medium text-text-secondary mb-1">
                        Número de capítulos: <span className="font-bold text-brand-dark">{numChapters}</span>
                    </label>
                    <input
                        id="numChapters"
                        type="range"
                        min="5"
                        max="20"
                        step="1"
                        value={numChapters}
                        onChange={(e) => setNumChapters(Number(e.target.value))}
                        disabled={isLoading}
                        className="w-full h-2 bg-brand-light rounded-lg appearance-none cursor-pointer accent-brand-primary"
                    />
                </div>
                 <div>
                    <label htmlFor="wordCount" className="block text-sm font-medium text-text-secondary mb-1">
                        Extensión aprox. (palabras): <span className="font-bold text-brand-dark">{wordCountTarget.toLocaleString('es-ES')}</span>
                    </label>
                    <input
                        id="wordCount"
                        type="range"
                        min="10000"
                        max="60000"
                        step="1000"
                        value={wordCountTarget}
                        onChange={(e) => setWordCountTarget(Number(e.target.value))}
                        disabled={isLoading}
                        className="w-full h-2 bg-brand-light rounded-lg appearance-none cursor-pointer accent-brand-primary"
                    />
                </div>
            </div>

            <label htmlFor="mainTopic" className="block text-sm font-medium text-text-secondary mb-1">Tema principal o material de origen</label>
            <textarea
                id="mainTopic"
                className="w-full h-60 p-4 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-brand-accent focus:border-brand-accent transition"
                placeholder="Pega un artículo completo, un resumen o simplemente describe el tema principal para tu libro. Ej: Un análisis sobre el impacto de la inteligencia artificial en la economía global del siglo XXI..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isLoading}
            />

            <button
                onClick={handleGenerateOutline}
                disabled={isLoading || !userInput.trim()}
                className="mt-6 w-full flex items-center justify-center bg-brand-primary text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-brand-dark transition-colors duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                {isLoading ? <><Icon name="loading" className="mr-2" /> {currentTask}</> : <><Icon name="generate" className="mr-2" /> Generar Estructura del Libro</>}
            </button>
        </div>
    );
    
    const renderOutlineStep = () => bookOutline && (
        <div className="w-full max-w-4xl">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">Paso 2: Revisa la estructura propuesta</h2>
            <p className="text-text-secondary mb-6">Esta es la estructura que la IA ha generado. Si estás de acuerdo, podemos comenzar a escribir el contenido.</p>
            <div className="bg-bg-card p-6 rounded-lg border border-gray-200 shadow-sm max-h-[60vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-brand-dark mb-4">{bookOutline.titulo}</h3>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold text-lg text-brand-secondary">{bookOutline.introduccion.titulo}</h4>
                    </div>
                    {bookOutline.capitulos.map((chapter, index) => (
                        <div key={index}>
                            <h4 className="font-semibold text-lg text-brand-secondary">Capítulo {index + 1}: {chapter.titulo}</h4>
                            <ul className="list-disc list-inside ml-4 mt-2 text-text-secondary">
                                {chapter.secciones.map((section, sIndex) => (
                                    <li key={sIndex}>{section}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                     <div>
                        <h4 className="font-semibold text-lg text-brand-secondary">{bookOutline.conclusion.titulo}</h4>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex space-x-4">
                <button
                    onClick={() => { setStep(AppStep.Input); setBookOutline(null); }}
                    className="flex-1 bg-gray-500 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-gray-600 transition-colors duration-300"
                >
                    Volver y Editar
                </button>
                <button
                    onClick={handleGenerateBook}
                    className="flex-1 bg-brand-primary text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-brand-dark transition-colors duration-300"
                >
                    <Icon name="book" className="mr-2 inline"/> Comenzar a Escribir
                </button>
            </div>
        </div>
    );

    const renderGeneratingStep = () => (
        <div className="w-full max-w-4xl text-center">
            <h2 className="text-2xl font-semibold text-text-primary mb-4">Paso 3: Generando el contenido de tu libro</h2>
            <p className="text-text-secondary mb-6">Este proceso puede tardar varios minutos. Por favor, mantén esta ventana abierta.</p>
            <div className="bg-bg-card p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-center items-center mb-4">
                    <Icon name="loading" className="w-12 h-12 text-brand-primary" />
                </div>
                <p className="text-lg font-medium text-brand-dark mb-4">{currentTask}</p>
                <ProgressBar progress={progress} />
                <p className="mt-4 text-sm text-text-secondary">Progreso: {Math.round(progress)}%</p>
                <p className="mt-2 text-lg font-bold text-brand-primary">Conteo de palabras: {wordCount.toLocaleString('es-ES')}</p>
            </div>
             {generatedBook && <div className="mt-4 text-left p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto border">
                <h3 className="font-bold mb-2">Contenido generado hasta ahora:</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{generatedBook.capitulos.flatMap(c => c.contenido?.map(s => `## ${s.titulo}\n${s.texto.substring(0, 200)}...`) ?? []).join('\n\n')}</p>
            </div>}
        </div>
    );

     const renderReviewStep = () => generatedBook && (
        <div className="w-full max-w-6xl">
            <div className="flex justify-between items-center mb-4">
                 <div>
                    <h2 className="text-2xl font-semibold text-text-primary">Paso 4: Revisa y exporta tu libro</h2>
                    <p className="text-text-secondary">Tu libro está listo. Puedes revisarlo aquí o descargarlo como un archivo .DOCX.</p>
                 </div>
                 <button
                    onClick={handleExport}
                    className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-green-700 transition-colors duration-300 flex items-center"
                >
                    <Icon name="download" className="mr-2" /> Exportar a .DOCX
                </button>
            </div>
            <div className="bg-bg-card p-6 rounded-lg border border-gray-200 shadow-sm max-h-[70vh] overflow-y-auto">
                <h1 className="text-3xl font-bold text-center text-brand-dark mb-8">{generatedBook.titulo}</h1>

                <h2 className="text-2xl font-bold text-brand-secondary mt-8 mb-4">{generatedBook.introduccion.titulo}</h2>
                <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{generatedBook.introduccion.texto}</p>

                {generatedBook.capitulos.map((chapter, index) => (
                    <div key={index}>
                        <h2 className="text-2xl font-bold text-brand-secondary mt-8 mb-4">Capítulo {index + 1}: {chapter.titulo}</h2>
                        {chapter.contenido?.map((section, sIndex) => (
                            <div key={sIndex} className="mb-6">
                                <h3 className="text-xl font-semibold text-brand-accent mb-2">{section.titulo}</h3>
                                <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{section.texto}</p>
                            </div>
                        ))}
                    </div>
                ))}

                <h2 className="text-2xl font-bold text-brand-secondary mt-8 mb-4">{generatedBook.conclusion.titulo}</h2>
                <p className="text-text-primary whitespace-pre-wrap leading-relaxed">{generatedBook.conclusion.texto}</p>

                <h2 className="text-2xl font-bold text-brand-secondary mt-8 mb-4">Referencias</h2>
                <div className="text-sm text-text-secondary space-y-2">
                    {[
                        ...new Set([
                            ...generatedBook.introduccion.referencias,
                            ...generatedBook.capitulos.flatMap(c => c.contenido?.flatMap(s => s.referencias) ?? []),
                            ...generatedBook.conclusion.referencias
                        ])
                    ].sort().map((ref, index) => (
                        <p key={index}>{ref}</p>
                    ))}
                </div>
            </div>
             <div className="mt-6 text-center">
                <button
                    onClick={() => { setStep(AppStep.Input); setUserInput(''); setBookOutline(null); setGeneratedBook(null); setWordCount(0); }}
                    className="bg-brand-primary text-white font-bold py-3 px-8 rounded-lg shadow-md hover:bg-brand-dark transition-colors duration-300"
                >
                    Crear un Nuevo Libro
                </button>
            </div>
        </div>
    );


    const renderContent = () => {
        switch (step) {
            case AppStep.Input:
                return renderInputStep();
            case AppStep.Outline:
                return renderOutlineStep();
            case AppStep.Generating:
                return renderGeneratingStep();
            case AppStep.Review:
                return renderReviewStep();
            default:
                return renderInputStep();
        }
    };
    
    return (
        <div className="min-h-screen flex flex-col font-sans text-text-primary bg-bg-main">
            {renderHeader()}
            <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col justify-center items-center">
                 {error && (
                    <div className="w-full max-w-3xl bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold"><Icon name="error" className="inline mr-2" />Error: </strong>
                        <span className="block sm:inline">{error}</span>
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError('')}>
                            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Cerrar</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </span>
                    </div>
                )}
                {renderContent()}
            </main>
            <footer className="bg-gray-200 text-center p-4 text-sm text-text-secondary">
                <p>&copy; {new Date().getFullYear()} Asistente de Escritura Académica. Creado con React y Gemini API.</p>
            </footer>
        </div>
    );
};

export default App;
