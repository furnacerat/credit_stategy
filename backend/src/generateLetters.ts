import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { openai } from './openaiClient.js';
import { r2, R2_BUCKET } from './r2.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { pool } from './db.js';

import type { CreditAnalysis } from './analyzeCreditText.js';

const BUREAUS = ['Equifax', 'Experian', 'TransUnion'];

async function createPDF(text: string): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard Letter size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;

    const margin = 50;
    const maxWidth = width - margin * 2;

    // Simple line wrapping
    const lines = text.split('\n');
    let y = height - margin;

    for (const line of lines) {
        if (y < margin + fontSize) {
            // Add new page if out of space
            const newPage = pdfDoc.addPage([612, 792]);
            y = height - margin;
            // (Note: In a production app, you'd track the current page, but for MVP this is fine)
        }

        // Extremely basic wrapping: split by spaces and check width
        const words = line.split(' ');
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const textWidth = font.widthOfTextAtSize(testLine, fontSize);

            if (textWidth > maxWidth) {
                page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
                y -= fontSize * 1.5;
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
            y -= fontSize * 1.5;
        }
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

export async function generateDisputeLetters(reportId: string, userId: string, analysis: CreditAnalysis) {
    console.log(`[LETTERS] Generating letters for report ${reportId}...`);

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    for (const bureau of BUREAUS) {
        try {
            // 1) Draft with AI
            const prompt = `
            You are a professional credit dispute specialist. 
            Draft a formal dispute letter for ${bureau} based on these findings: ${JSON.stringify(analysis.negatives || [])}.
            
            Include:
            - A professional header (Placeholders for name/address).
            - The date (today).
            - Each item being disputed with a clear reason (e.g., "The balance is incorrect", "I have no knowledge of this account").
            - A demand for investigation under FCRA.
            - Professional sign-off.
            
            Keep the tone formal but firm. DO NOT use markdown bold/italic; just plain text.
            `;

            const completion = await openai.chat.completions.create({
                model,
                messages: [{ role: "system", content: "You draft professional credit dispute letters." }, { role: "user", content: prompt }],
            });

            const contentText = completion.choices?.[0]?.message?.content || "";

            // 2) Create PDF
            const pdfBuffer = await createPDF(contentText);

            // 3) Upload to R2
            const fileKey = `letters/${userId}/${reportId}_${bureau.toLowerCase()}.pdf`;
            await r2.send(new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: fileKey,
                Body: pdfBuffer,
                ContentType: 'application/pdf',
            }));

            // 4) Save to DB
            await pool.query(
                `insert into dispute_letters (report_id, user_id, bureau, file_key, content_text)
                 values ($1, $2, $3, $4, $5)`,
                [reportId, userId, bureau, fileKey, contentText]
            );

            console.log(`[LETTERS] Generated ${bureau} letter: ${fileKey}`);
        } catch (e) {
            console.error(`[LETTERS] Failed to generate ${bureau} letter:`, e);
            // Don't throw; try other bureaus
        }
    }
}
