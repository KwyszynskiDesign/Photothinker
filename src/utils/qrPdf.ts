import { jsPDF } from 'jspdf';

export type SignFormat = 'a4' | 'a5';

const HELPER_TEXT = 'Zeskanuj kod i dodaj zdjęcia';

// Rozmiary skalowane proporcjonalnie do formatu strony — A5 dostaje mniejszy QR
// niż A4, nie identyczny kod wciśnięty na mniejszą kartkę.
const LAYOUT: Record<SignFormat, { qrSize: number; titleSize: number; helperSize: number; linkSize: number }> = {
  a4: { qrSize: 130, titleSize: 26, helperSize: 14, linkSize: 10 },
  a5: { qrSize: 90, titleSize: 20, helperSize: 12, linkSize: 9 },
};

// Gotowa do druku plansza wydarzenia: nazwa + tekst dla gości + duży QR + link.
// Współdzieli tę samą logikę dla A4 i A5, żeby nie utrzymywać dwóch niemal
// identycznych layoutów osobno.
export function buildEventSignPdf(
  qrCanvas: HTMLCanvasElement,
  eventName: string,
  guestUrl: string,
  format: SignFormat
): Blob {
  const pdf = new jsPDF({ unit: 'mm', format });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const { qrSize, titleSize, helperSize, linkSize } = LAYOUT[format];
  const centerX = pageWidth / 2;

  const qrY = (pageHeight - qrSize) / 2;
  const qrX = centerX - qrSize / 2;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(titleSize);
  pdf.text(eventName, centerX, qrY - 26, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(helperSize);
  pdf.text(HELPER_TEXT, centerX, qrY - 12, { align: 'center' });

  pdf.addImage(qrCanvas.toDataURL('image/png'), 'PNG', qrX, qrY, qrSize, qrSize);

  pdf.setFontSize(linkSize);
  pdf.setTextColor(120, 113, 105);
  pdf.text(guestUrl, centerX, qrY + qrSize + 10, { align: 'center' });

  return pdf.output('blob');
}
