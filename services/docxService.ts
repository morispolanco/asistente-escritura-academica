
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    PageBreak,
} from 'docx';
import type { GeneratedBook } from '../types';

// This function analyzes a single line of text and returns a styled paragraph.
const createStyledParagraphFromLine = (line: string): Paragraph => {
    const trimmedLine = line.trim();

    // Rule 4: Handle headings from hashtags
    if (trimmedLine.startsWith('# ')) {
        return new Paragraph({ text: trimmedLine.substring(2), style: 'Heading1' });
    }
    if (trimmedLine.startsWith('## ')) {
        return new Paragraph({ text: trimmedLine.substring(3), style: 'Heading2' });
    }
    if (trimmedLine.startsWith('### ')) {
        return new Paragraph({ text: trimmedLine.substring(4), style: 'Heading3' });
    }

    // Rules 1, 2, 3: Handle inline bold and italic formatting
    const runs: TextRun[] = [];
    // This regular expression splits the string by the formatting markers, keeping them.
    const parts = trimmedLine.split(/(\*\*.*?\*\*|\*.*?\*)/g).filter(p => p);

    for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
            // Rule 1: Bold
            runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
        } else if (part.startsWith('*') && part.endsWith('*')) {
            // Rule 2: Italic
            runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
        } else {
            // Rule 3: Normal text
            runs.push(new TextRun(part));
        }
    }
    
    // Rule 5: Normal paragraph style
    return new Paragraph({ children: runs, style: 'normal' });
};

export const exportToDocx = async (book: GeneratedBook) => {
    if (!book) return;
    
    const isEnglish = book.outputLanguage === 'en';
    const children: Paragraph[] = [];

    // Book title
    children.push(new Paragraph({ text: book.titulo, style: 'Heading1' }));

    // Introduction
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ text: book.introduccion.titulo, style: 'Heading1' }));
    book.introduccion.texto.split('\n').filter(line => line.trim()).forEach(line => {
        children.push(createStyledParagraphFromLine(line));
    });

    // Chapters
    book.capitulos.forEach((chapter, index) => {
        // Rule 9: Page break before each chapter
        children.push(new Paragraph({ children: [new PageBreak()] }));
        const chapterTitle = isEnglish ? `Chapter ${index + 1}: ${chapter.titulo}` : `Capítulo ${index + 1}: ${chapter.titulo}`;
        children.push(new Paragraph({ text: chapterTitle, style: 'Heading1' }));

        chapter.contenido?.forEach(section => {
            children.push(new Paragraph({ text: section.titulo, style: 'Heading2' }));
            section.texto.split('\n').filter(line => line.trim()).forEach(line => {
                children.push(createStyledParagraphFromLine(line));
            });
        });
    });

    // Conclusion
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ text: book.conclusion.titulo, style: 'Heading1' }));
    book.conclusion.texto.split('\n').filter(line => line.trim()).forEach(line => {
        children.push(createStyledParagraphFromLine(line));
    });

    // References
    const sortedReferences = book.referencias.sort();

    if (sortedReferences.length > 0) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
        const referencesTitle = isEnglish ? "References" : "Referencias";
        children.push(new Paragraph({ text: referencesTitle, style: 'Heading1' }));
        sortedReferences.forEach(ref => {
            children.push(new Paragraph({
                text: ref.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
                style: 'reference'
            }));
        });
    }
    
    // Rules 5, 6, 7, 8: Define styles and create the document
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
                        spacing: { before: 0, after: 160, line: 240 }, // Single spacing, 8pt space after
                    },
                },
                {
                    id: 'Heading1',
                    name: 'Heading 1',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: { font: 'Aptos', size: 36, bold: true }, // 18pt
                    paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 240 } }, // 12pt after
                },
                {
                    id: 'Heading2',
                    name: 'Heading 2',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: { font: 'Aptos', size: 32, bold: true }, // 16pt
                    paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 240 } }, // 12pt after
                },
                {
                    id: 'Heading3',
                    name: 'Heading 3',
                    basedOn: 'Normal',
                    next: 'Normal',
                    run: { font: 'Aptos', size: 28, bold: true }, // 14pt
                    paragraph: { alignment: AlignmentType.LEFT, spacing: { after: 240 } }, // 12pt after
                },
                {
                    id: 'reference',
                    name: 'Reference',
                    basedOn: 'normal',
                    paragraph: {
                        indent: { hanging: 720 }, // 0.5 inch hanging indent
                    },
                }
            ],
        },
    });

    // Package and download the document
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
