import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QuoteSettingsService } from './quote-settings.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake/build/pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfMakeFonts = require('pdfmake/build/vfs_fonts');

// pdfmake v0.2+ exports fonts directly at top level; older versions nest under pdfMake.vfs
const vfs: Record<string, string> = pdfMakeFonts?.pdfMake?.vfs ?? pdfMakeFonts;

const fonts = {
  Roboto: {
    normal:      Buffer.from(vfs['Roboto-Regular.ttf'],      'base64'),
    bold:        Buffer.from(vfs['Roboto-Medium.ttf'],        'base64'),
    italics:     Buffer.from(vfs['Roboto-Italic.ttf'],        'base64'),
    bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteSettingsService: QuoteSettingsService,
  ) {}

  private createPrinter() {
    // pdfmake/build/pdfmake exports a pre-built client bundle; for server use
    // we need the raw Printer class from the source tree.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PdfPrinterClass = require('pdfmake/js/Printer');
    const Ctor = PdfPrinterClass.default ?? PdfPrinterClass;
    return new Ctor(fonts);
  }

  async generateQuotePdf(quoteId: string, organizationId: string): Promise<Buffer> {
    const quote = await this.prisma.quote.findFirstOrThrow({
      where: { id: quoteId, organizationId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        lead: true,
        client: true,
        createdBy: true,
      },
    });

    const settings = await this.quoteSettingsService.getSettings(organizationId);

    const printer = this.createPrinter();
    const currency = quote.currency || settings.defaultCurrency || 'USD';
    const accentColor = settings.accentColor || '#b8873a';
    const quoteNumberStr = `${settings.quoteNumberPrefix || 'Q-'}${quote.quoteNumber.toString().padStart(4, '0')}`;
    const recipient =
      (quote.lead as any)?.company || (quote.client as any)?.name || 'N/A';
    const contactEmail =
      (quote.lead as any)?.email || (quote.client as any)?.email || null;
    const issuedDate = new Date(quote.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const validUntilStr = quote.validUntil
      ? new Date(quote.validUntil).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'N/A';

    const companyInfoLines: object[] = [];
    if (settings.companyAddress) {
      companyInfoLines.push({
        text: settings.companyAddress,
        fontSize: 9,
        color: '#555555',
      });
    }
    const contactParts: string[] = [];
    if (settings.companyPhone) contactParts.push(settings.companyPhone);
    if (settings.companyEmail) contactParts.push(settings.companyEmail);
    if (settings.companyWebsite) contactParts.push(settings.companyWebsite);
    if (contactParts.length > 0) {
      companyInfoLines.push({
        text: contactParts.join('  |  '),
        fontSize: 9,
        color: '#555555',
      });
    }

    const tableHeaderRow = [
      {
        text: 'Description',
        bold: true,
        color: '#ffffff',
        fillColor: accentColor,
      },
      {
        text: 'Qty',
        bold: true,
        color: '#ffffff',
        fillColor: accentColor,
        alignment: 'center' as const,
      },
      {
        text: 'Unit Price',
        bold: true,
        color: '#ffffff',
        fillColor: accentColor,
        alignment: 'right' as const,
      },
      {
        text: 'Amount',
        bold: true,
        color: '#ffffff',
        fillColor: accentColor,
        alignment: 'right' as const,
      },
    ];

    const dataRows = quote.lineItems.map((item, index) => {
      const rowFill = index % 2 === 0 ? '#ffffff' : '#f7f9fc';
      return [
        { text: item.description, fontSize: 9, fillColor: rowFill },
        {
          text: String(item.quantity),
          fontSize: 9,
          alignment: 'center' as const,
          fillColor: rowFill,
        },
        {
          text: formatCurrency(Number(item.unitPrice), currency),
          fontSize: 9,
          alignment: 'right' as const,
          fillColor: rowFill,
        },
        {
          text: formatCurrency(Number(item.lineTotal), currency),
          fontSize: 9,
          alignment: 'right' as const,
          fillColor: rowFill,
        },
      ];
    });

    const totalsStack: object[] = [
      {
        columns: [
          {
            text: 'Subtotal',
            width: '*',
            alignment: 'right' as const,
            fontSize: 9,
            color: '#555555',
          },
          {
            text: formatCurrency(Number(quote.subtotal), currency),
            width: 110,
            alignment: 'right' as const,
            fontSize: 9,
          },
        ],
        margin: [0, 2, 0, 2],
      },
    ];

    if (settings.showTaxLine) {
      totalsStack.push({
        columns: [
          {
            text: `Tax (${quote.taxRate}%)`,
            width: '*',
            alignment: 'right' as const,
            fontSize: 9,
            color: '#555555',
          },
          {
            text: formatCurrency(Number(quote.taxAmount), currency),
            width: 110,
            alignment: 'right' as const,
            fontSize: 9,
          },
        ],
        margin: [0, 2, 0, 2],
      });
    }

    if (settings.showDiscountLine && Number(quote.discount) > 0) {
      totalsStack.push({
        columns: [
          {
            text: 'Discount',
            width: '*',
            alignment: 'right' as const,
            fontSize: 9,
            color: '#555555',
          },
          {
            text: `- ${formatCurrency(Number(quote.discount), currency)}`,
            width: 110,
            alignment: 'right' as const,
            fontSize: 9,
            color: '#c0392b',
          },
        ],
        margin: [0, 2, 0, 2],
      });
    }

    totalsStack.push({
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 0.5,
          lineColor: '#cccccc',
        },
      ],
      margin: [0, 4, 0, 4],
    });

    totalsStack.push({
      columns: [
        {
          text: 'Total',
          width: '*',
          alignment: 'right' as const,
          fontSize: 12,
          bold: true,
        },
        {
          text: formatCurrency(Number(quote.total), currency),
          width: 110,
          alignment: 'right' as const,
          fontSize: 12,
          bold: true,
          color: accentColor,
        },
      ],
      margin: [0, 2, 0, 2],
    });

    const content: object[] = [
      {
        columns: [
          {
            stack: [
              {
                text: settings.companyName || 'Your Company',
                fontSize: 20,
                bold: true,
                color: accentColor,
              },
              ...companyInfoLines,
            ],
          },
          {
            stack: [
              {
                text: 'QUOTE',
                fontSize: 22,
                bold: true,
                alignment: 'right' as const,
                color: '#333333',
              },
              {
                text: quoteNumberStr,
                fontSize: 11,
                alignment: 'right' as const,
                color: '#555555',
                margin: [0, 2, 0, 0],
              },
              {
                text: `Issued: ${issuedDate}`,
                fontSize: 9,
                alignment: 'right' as const,
                color: '#888888',
                margin: [0, 4, 0, 0],
              },
              {
                text: `Valid Until: ${validUntilStr}`,
                fontSize: 9,
                alignment: 'right' as const,
                color: '#888888',
              },
            ],
          },
        ],
        margin: [0, 0, 0, 24],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: accentColor,
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        stack: [
          {
            text: 'BILL TO',
            fontSize: 8,
            bold: true,
            color: '#888888',
            letterSpacing: 1,
          },
          {
            text: recipient,
            fontSize: 13,
            bold: true,
            color: '#222222',
            margin: [0, 4, 0, 2],
          },
          ...(contactEmail
            ? [{ text: contactEmail, fontSize: 9, color: '#555555' }]
            : []),
        ],
        margin: [0, 0, 0, 24],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [tableHeaderRow, ...dataRows],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e0e0e0',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 16],
      },
      {
        stack: totalsStack,
        margin: [0, 0, 0, 24],
      },
    ];

    if (quote.notes) {
      content.push({
        stack: [
          {
            text: 'NOTES',
            fontSize: 8,
            bold: true,
            color: '#888888',
            letterSpacing: 1,
            margin: [0, 0, 0, 4],
          },
          {
            text: quote.notes,
            fontSize: 9,
            color: '#444444',
            lineHeight: 1.4,
          },
        ],
        margin: [0, 0, 0, 16],
      });
    }

    if (quote.termsAndConditions) {
      content.push({
        stack: [
          {
            text: 'TERMS & CONDITIONS',
            fontSize: 8,
            bold: true,
            color: '#888888',
            letterSpacing: 1,
            margin: [0, 0, 0, 4],
          },
          {
            text: quote.termsAndConditions,
            fontSize: 9,
            color: '#444444',
            lineHeight: 1.4,
          },
        ],
        margin: [0, 0, 0, 24],
      });
    }

    if (settings.showSignatureBlock) {
      content.push({
        stack: [
          {
            text: '___________________________',
            fontSize: 12,
            color: '#333333',
            margin: [0, 0, 0, 4],
          },
          { text: 'Signature', fontSize: 9, color: '#888888' },
        ],
        margin: [0, 16, 0, 0],
      });
    }

    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [40, 40, 40, 60] as [number, number, number, number],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        color: '#333333',
      },
      content,
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center' as const,
        fontSize: 8,
        color: '#aaaaaa',
        margin: [0, 10, 0, 0],
      }),
    };

    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }

  async generateScopePdf(quoteId: string, organizationId: string): Promise<Buffer> {
    const quote = await this.prisma.quote.findFirstOrThrow({
      where: { id: quoteId, organizationId },
      include: {
        lineItems: {
          orderBy: { sortOrder: 'asc' },
          include: {
            serviceItem: {
              include: {
                subtasks: {
                  orderBy: { sortOrder: 'asc' },
                  include: { roleEstimates: { orderBy: { role: 'asc' } } },
                },
              },
            },
          },
        },
      },
    });

    const settings = await this.quoteSettingsService.getSettings(organizationId);
    const printer = this.createPrinter();
    const accentColor = settings.accentColor || '#b8873a';
    const sowNumberStr = `SOW-${quote.quoteNumber.toString().padStart(4, '0')}`;

    const companyInfoLines: object[] = [];
    if (settings.companyAddress) {
      companyInfoLines.push({
        text: settings.companyAddress,
        fontSize: 9,
        color: '#555555',
      });
    }
    const contactParts: string[] = [];
    if (settings.companyPhone) contactParts.push(settings.companyPhone);
    if (settings.companyEmail) contactParts.push(settings.companyEmail);
    if (settings.companyWebsite) contactParts.push(settings.companyWebsite);
    if (contactParts.length > 0) {
      companyInfoLines.push({
        text: contactParts.join('  |  '),
        fontSize: 9,
        color: '#555555',
      });
    }

    const content: object[] = [
      {
        columns: [
          {
            stack: [
              {
                text: settings.companyName || 'Your Company',
                fontSize: 20,
                bold: true,
                color: accentColor,
              },
              ...companyInfoLines,
            ],
          },
          {
            stack: [
              {
                text: 'SCOPE OF WORK',
                fontSize: 22,
                bold: true,
                alignment: 'right' as const,
                color: '#333333',
              },
              {
                text: sowNumberStr,
                fontSize: 11,
                alignment: 'right' as const,
                color: '#555555',
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 24],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: accentColor,
          },
        ],
        margin: [0, 0, 0, 16],
      },
    ];

    const itemsWithServiceItem = (quote.lineItems as any[]).filter(
      (li) => li.serviceItem,
    );

    if (itemsWithServiceItem.length === 0) {
      content.push({
        text: 'No service items attached to this quote.',
        fontSize: 10,
        color: '#888888',
      });
    } else {
      for (const item of itemsWithServiceItem) {
        const si = item.serviceItem;

        content.push({
          text: si.name,
          fontSize: 12,
          bold: true,
          color: accentColor,
          margin: [0, 12, 0, 6],
        });

        if (si.description) {
          content.push({
            text: si.description,
            fontSize: 9,
            color: '#555555',
            margin: [0, 0, 0, 8],
          });
        }

        const subtasks: any[] = si.subtasks ?? [];
        if (subtasks.length > 0) {
          const tableHeaderRow = [
            {
              text: 'Subtask',
              bold: true,
              color: '#ffffff',
              fillColor: accentColor,
            },
            {
              text: 'Role',
              bold: true,
              color: '#ffffff',
              fillColor: accentColor,
            },
            {
              text: 'Est. Hours',
              bold: true,
              color: '#ffffff',
              fillColor: accentColor,
              alignment: 'right' as const,
            },
          ];

          const dataRows: object[] = [];
          for (const subtask of subtasks) {
            const roleEstimates: any[] = subtask.roleEstimates ?? [];
            if (roleEstimates.length === 0) {
              dataRows.push([
                { text: subtask.name, fontSize: 9 },
                { text: '—', fontSize: 9 },
                { text: '—', fontSize: 9, alignment: 'right' as const },
              ]);
            } else {
              for (const re of roleEstimates) {
                dataRows.push([
                  { text: subtask.name, fontSize: 9 },
                  { text: re.role, fontSize: 9 },
                  {
                    text: String(re.estimatedHours),
                    fontSize: 9,
                    alignment: 'right' as const,
                  },
                ]);
              }
            }
          }

          content.push({
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto'],
              body: [tableHeaderRow, ...dataRows],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0,
              hLineColor: () => '#e0e0e0',
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
            margin: [0, 0, 0, 8],
          });
        }
      }
    }

    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [40, 40, 40, 60] as [number, number, number, number],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        color: '#333333',
      },
      content,
      footer: (currentPage: number, pageCount: number) => ({
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: 'center' as const,
        fontSize: 8,
        color: '#aaaaaa',
        margin: [0, 10, 0, 0],
      }),
    };

    const pdfDoc = await printer.createPdfKitDocument(docDefinition);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}

// Suppress unused import warning — PdfPrinter is used via require() for the build bundle check
void PdfPrinter;
