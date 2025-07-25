import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    PageBreak,
} from 'docx';
import type { GeneratedBook } from '../types';

// Esta función analiza una sola línea de texto y devuelve un párrafo con estilo.
const createStyledParagraphFromLine = (line: string): Paragraph => {
    const trimmedLine = line.trim();

    // Regla 4: Manejar encabezados a partir de hashtags
    if (trimmedLine.startsWith('# ')) {
        return new Paragraph({ text: trimmedLine.substring(2), style: 'Heading1' });
    }
    if (trimmedLine.startsWith('## ')) {
        return new Paragraph({ text: trimmedLine.substring(3), style: 'Heading2' });
    }
    if (trimmedLine.startsWith('### ')) {
        return new Paragraph({ text: trimmedLine.substring(4), style: 'Heading3' });
    }

    // Reglas 1, 2, 3: Manejar formato de negrita y cursiva en línea
    const runs: TextRun[] = [];
    // Esta expresión regular divide la cadena por los marcadores de formato, manteniéndolos.
    const parts = trimmedLine.split(/(\*\*.*?\*\*|\*.*?\*)/g).filter(p => p);

    for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
            // Regla 1: Negrita
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
        } else if (part.startsWith('*') && part.endsWith('*')) {
            // Regla 2: Cursiva
            runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
        } else {
            // Regla 3: Texto normal (incluye asteriscos sin cerrar)
            runs.push(new TextRun(part));
        }
    }
    
    // Regla 5: Estilo de párrafo normal
    return new Paragraph({ children: runs, style: 'normal' });
};

export const exportToDocx = async (book: GeneratedBook) => {
    if (!book) return;

    const children: Paragraph[] = [];

    // Título del libro
    children.push(new Paragraph({ text: book.titulo, style: 'Heading1' }));

    // Introducción
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ text: book.introduccion.titulo, style: 'Heading1' }));
    book.introduccion.texto.split('\n').filter(line => line.trim()).forEach(line => {
        children.push(createStyledParagraphFromLine(line));
    });

    // Capítulos
    book.capitulos.forEach((chapter, index) => {
        // Regla 9: Salto de página antes de cada capítulo
        children.push(new Paragraph({ children: [new PageBreak()] }));
        const chapterTitle = `Capítulo ${index + 1}: ${chapter.titulo}`;
        children.push(new Paragraph({ text: chapterTitle, style: 'Heading1' }));

        chapter.contenido?.forEach(section => {
            children.push(new Paragraph({ text: section.titulo, style: 'Heading2' }));
            section.texto.split('\n').filter(line => line.trim()).forEach(line => {
                children.push(createStyledParagraphFromLine(line));
            });
        });
    });

    // Conclusión
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ text: book.conclusion.titulo, style: 'Heading1' }));
    book.conclusion.texto.split('\n').filter(line => line.trim()).forEach(line => {
        children.push(createStyledParagraphFromLine(line));
    });

    // Referencias
    const allReferences = new Set<string>();
    book.introduccion.referencias.forEach(ref => allReferences.add(ref));
    book.capitulos.forEach(chapter => chapter.contenido?.forEach(section => section.referencias.forEach(ref => allReferences.add(ref))));
    book.conclusion.referencias.forEach(ref => allReferences.add(ref));
    const sortedReferences = Array.from(allReferences).sort();

    if (sortedReferences.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        children.push(new Paragraph({ text: "Referencias", style: 'Heading1' }));
        sortedReferences.forEach(ref => {
            children.push(new Paragraph({
                text: ref.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
                style: 'reference'
            }));
        });
    }
    
    // Reglas 5, 6, 7, 8: Definir estilos y crear el documento
    const doc = new Document({
        sections: [{ children }],
        styles: {
            paragraphStyles: [
                {
                    id: 'normal',
                    name: 'Normal',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: { font: 'Aptos', size: 24 }, // 12pt
                    paragraph: {
                        alignment: AlignmentType.JUSTIFIED,
                        spacing: { before: 0, after: 160, line: 240 }, // Interlineado sencillo, 8pt de espacio después
                    },
                },
                {
                    id: 'Heading1',
                    name: 'Heading 1',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: { font: 'Aptos', size: 36, bold: true }, // 18pt
                    paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 240 } }, // 12pt después
                },
                {
                    id: 'Heading2',
                    name: 'Heading 2',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: { font: 'Aptos', size: 32, bold: true }, // 16pt
                    paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 240 } }, // 12pt después
                },
                {
                    id: 'Heading3',
                    name: 'Heading 3',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: { font: 'Aptos', size: 28, bold: true }, // 14pt
                    paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 240 } }, // 12pt después
                },
                {
                    id: 'reference',
                    name: 'Reference',
                    basedOn: 'normal',
                    paragraph: {
                        indent: { hanging: 720 }, // Sangría francesa de 0.5 pulgadas
                    },
                }
            ],
        },
    });

    // Empaquetar y descargar el documento
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book.titulo.toLowerCase().replace(/[\s\W]+/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};