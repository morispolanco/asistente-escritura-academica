
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LineRuleType } from 'docx';
import type { GeneratedBook } from '../types';

export const exportToDocx = (book: GeneratedBook) => {
    if (!book) return;

    const allReferences = new Set<string>();
    book.introduccion.referencias.forEach(ref => allReferences.add(ref));
    book.capitulos.forEach(chapter => {
        chapter.contenido?.forEach(section => {
            section.referencias.forEach(ref => allReferences.add(ref));
        });
    });
    book.conclusion.referencias.forEach(ref => allReferences.add(ref));

    const children = [
        new Paragraph({ text: book.titulo, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    ];

    // Introducción
    children.push(new Paragraph({ text: book.introduccion.titulo, heading: HeadingLevel.HEADING_1 }));
    book.introduccion.texto.split('\n\n').forEach(p => children.push(new Paragraph({ text: p, style: "Normal" })));

    // Capítulos
    book.capitulos.forEach((chapter, index) => {
        children.push(new Paragraph({ text: `Capítulo ${index + 1}: ${chapter.titulo}`, heading: HeadingLevel.HEADING_1 }));
        chapter.contenido?.forEach(section => {
            children.push(new Paragraph({ text: section.titulo, heading: HeadingLevel.HEADING_2 }));
            section.texto.split('\n\n').forEach(p => children.push(new Paragraph({ text: p, style: "Normal" })));
        });
    });

    // Conclusión
    children.push(new Paragraph({ text: book.conclusion.titulo, heading: HeadingLevel.HEADING_1 }));
    book.conclusion.texto.split('\n\n').forEach(p => children.push(new Paragraph({ text: p, style: "Normal" })));

    // Referencias
    children.push(new Paragraph({ text: "Referencias", heading: HeadingLevel.HEADING_1 }));
    Array.from(allReferences).sort().forEach(ref => {
        children.push(new Paragraph({
            text: ref,
            style: "Normal",
            indent: {
                hanging: 720 // 0.5 inch
            }
        }));
    });

    const doc = new Document({
        creator: "Asistente de Escritura Académica",
        title: book.titulo,
        description: `Libro generado sobre ${book.titulo}`,
        styles: {
            paragraphStyles: [
                {
                    id: "Normal",
                    name: "Normal",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Calibri",
                        size: 24, // 12pt
                        color: "000000",
                    },
                    paragraph: {
                        spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO }, // 6pt after, 1.5 lines
                    },
                },
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Calibri",
                        size: 36, // 18pt
                        bold: true,
                        color: "0D47A1",
                    },
                    paragraph: {
                        spacing: { before: 480, after: 240 },
                    },
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Calibri",
                        size: 28, // 14pt
                        bold: true,
                        color: "1976D2",
                    },
                    paragraph: {
                        spacing: { before: 360, after: 180 },
                    },
                },
            ],
        },
        sections: [{
            properties: {},
            children: children,
        }],
    });

    Packer.toBlob(doc).then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${book.titulo.toLowerCase().replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
};
