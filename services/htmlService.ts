
import type { GeneratedBook } from '../types';

const generateHtmlContent = (book: GeneratedBook): string => {
    const isEnglish = book.outputLanguage === 'en';

    const bodyContent = `
        <article>
            <h1 class="book-title">${book.titulo}</h1>

            <section>
                <h2 class="h1">${book.introduccion.titulo}</h2>
                <div class="content">${book.introduccion.texto}</div>
                 ${book.introduccion.referencias && book.introduccion.referencias.length > 0 ? `
                    <h3 class="h2">${isEnglish ? 'References' : 'Referencias'}</h3>
                    <div class="references">
                        ${book.introduccion.referencias.sort().map(ref => `<p>${ref.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>`).join('')}
                    </div>
                ` : ''}
            </section>

            ${book.capitulos.map((chapter, index) => `
                <section>
                    <h2 class="h1">${isEnglish ? 'Chapter' : 'Capítulo'} ${index + 1}: ${chapter.titulo}</h2>
                    ${chapter.contenido?.map(section => `
                        <div class="section-content">
                            <h3 class="h2">${section.titulo}</h3>
                            <div class="content">${section.texto}</div>
                        </div>
                    `).join('')}
                    ${chapter.referencias && chapter.referencias.length > 0 ? `
                        <h3 class="h2">${isEnglish ? 'References' : 'Referencias'}</h3>
                        <div class="references">
                            ${chapter.referencias.sort().map(ref => `<p>${ref.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>`).join('')}
                        </div>
                    ` : ''}
                </section>
            `).join('')}

            <section>
                <h2 class="h1">${book.conclusion.titulo}</h2>
                <div class="content">${book.conclusion.texto}</div>
                ${book.conclusion.referencias && book.conclusion.referencias.length > 0 ? `
                    <h3 class="h2">${isEnglish ? 'References' : 'Referencias'}</h3>
                    <div class="references">
                        ${book.conclusion.referencias.sort().map(ref => `<p>${ref.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>`).join('')}
                    </div>
                ` : ''}
            </section>

        </article>
    `;

    return `
        <!DOCTYPE html>
        <html lang="${isEnglish ? 'en' : 'es'}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${book.titulo}</title>
            <style>
                body {
                    font-family: Calibri, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                    line-height: 1.6;
                    color: #212121;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 2rem;
                    background-color: #F5F5F5;
                }
                article {
                    background-color: #FFFFFF;
                    padding: 2rem 3rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .book-title {
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #002171;
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .h1 {
                    font-size: 2rem;
                    font-weight: bold;
                    color: #0D47A1;
                    margin-top: 2.5rem;
                    margin-bottom: 1rem;
                    border-bottom: 2px solid #42A5F5;
                    padding-bottom: 0.5rem;
                }
                .h2 {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #1976D2;
                    margin-top: 2rem;
                    margin-bottom: 1rem;
                }
                .content {
                    text-align: justify;
                    margin-bottom: 1rem;
                    white-space: pre-wrap;
                    line-height: 1.7;
                }
                .references p {
                    text-indent: -0.5in;
                    padding-left: 0.5in;
                    margin-bottom: 0.5rem;
                    word-break: break-all;
                }
            </style>
        </head>
        <body>
            ${bodyContent}
        </body>
        </html>
    `;
};

export const exportToHtml = (book: GeneratedBook) => {
    if (!book) return;

    const htmlString = generateHtmlContent(book);
    const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book.titulo.toLowerCase().replace(/[\s\W]+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};