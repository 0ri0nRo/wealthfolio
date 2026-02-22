// src/pages/Budget/components/ExportModal.tsx
// Dipendenze: npm install xlsx jspdf jspdf-autotable
import { BudgetTransaction } from '@/lib/types/budget';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

interface ExportModalProps {
  transactions: BudgetTransaction[];
  onClose: () => void;
}

type ExportFormat = 'excel' | 'pdf';

const fmtEur = (n: number) =>
  `€${Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;

const toDateStr = (d: Date) => d.toISOString().split('T')[0];

export const ExportModal: React.FC<ExportModalProps> = ({ transactions, onClose }) => {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [format, setFormat] = useState<ExportFormat>('excel');
  const [dateFrom, setDateFrom] = useState(toDateStr(firstOfMonth));
  const [dateTo, setDateTo]   = useState(toDateStr(now));
  const [exporting, setExporting] = useState(false);

  // ── Body lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const sy = window.scrollY;
    Object.assign(document.body.style, { overflow: 'hidden', position: 'fixed', width: '100%', top: `-${sy}px` });
    return () => {
      Object.assign(document.body.style, { overflow: '', position: '', width: '', top: '' });
      window.scrollTo(0, sy);
    };
  }, []);

  // ── Filtered transactions ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const from = new Date(dateFrom);
    const to   = new Date(dateTo);
    to.setHours(23, 59, 59);
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d >= from && d <= to;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, dateFrom, dateTo]);

  const totalIncome   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // ── Quick range presets ───────────────────────────────────────────────────
  const presets: { label: string; from: Date; to: Date }[] = [
    { label: 'This month',  from: firstOfMonth, to: now },
    { label: 'Last month',  from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 0) },
    { label: 'Last 3M',     from: new Date(now.getFullYear(), now.getMonth() - 3, 1), to: now },
    { label: 'This year',   from: new Date(now.getFullYear(), 0, 1), to: now },
    { label: 'All time',    from: new Date(2000, 0, 1), to: now },
  ];

  // ── Export Excel ─────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Transactions ──────────────────────────────────────────────
    const rows = [
      ['Date', 'Description', 'Category', 'Type', 'Amount (€)', 'Notes'],
      ...filtered.map(t => [
        t.date,
        t.description,
        t.category?.name ?? '',
        t.type === 'income' ? 'Income' : 'Expense',
        t.type === 'income' ? t.amount : -t.amount,
        t.notes ?? '',
      ]),
      [],
      ['', '', '', 'Total Income',   totalIncome,   ''],
      ['', '', '', 'Total Expenses', -totalExpenses, ''],
      ['', '', '', 'Balance',        totalIncome - totalExpenses, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 32 }, // Description
      { wch: 20 }, // Category
      { wch: 10 }, // Type
      { wch: 14 }, // Amount
      { wch: 28 }, // Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // ── Sheet 2: Summary by category ──────────────────────────────────────
    const catMap = new Map<string, number>();
    filtered.filter(t => t.type === 'expense').forEach(t => {
      const name = t.category?.name ?? 'Unknown';
      catMap.set(name, (catMap.get(name) ?? 0) + t.amount);
    });
    const catRows = [
      ['Category', 'Amount (€)', '% of total'],
      ...[...catMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, amt]) => [
          name,
          amt,
          totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(1)}%` : '0%',
        ]),
      [],
      ['TOTAL', totalExpenses, '100%'],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(catRows);
    ws2['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'By Category');

    const filename = `budget_${dateFrom}_${dateTo}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ── Export PDF ────────────────────────────────────────────────────────────
  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const periodLabel = `${dateFrom} → ${dateTo}`;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.text('Budget Export', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${periodLabel}`, 14, 25);
    doc.text(`Generated: ${new Date().toLocaleDateString('it-IT')}`, 14, 30);

    // Summary pills
    const summaryY = 36;
    const pills = [
      { label: 'Income',   value: fmtEur(totalIncome),              color: [22, 163, 74]  as [number,number,number] },
      { label: 'Expenses', value: fmtEur(totalExpenses),             color: [220, 38, 38]  as [number,number,number] },
      { label: 'Balance',  value: fmtEur(totalIncome - totalExpenses), color: totalIncome >= totalExpenses ? [37, 99, 235] as [number,number,number] : [220, 38, 38] as [number,number,number] },
    ];
    pills.forEach((p, i) => {
      const x = 14 + i * 70;
      doc.setFillColor(...p.color);
      doc.roundedRect(x, summaryY, 62, 14, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(p.label, x + 4, summaryY + 5.5);
      doc.setFontSize(10);
      doc.text(p.value, x + 4, summaryY + 11);
    });

    // Transactions table
    autoTable(doc, {
      startY: summaryY + 20,
      head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
      body: filtered.map(t => [
        t.date,
        t.description,
        t.category?.name ?? '',
        t.type === 'income' ? 'Income' : 'Expense',
        (t.type === 'income' ? '+' : '-') + fmtEur(t.amount),
      ]),
      foot: [[
        '', '', '', 'Balance',
        `${totalIncome >= totalExpenses ? '+' : '-'}${fmtEur(Math.abs(totalIncome - totalExpenses))}`,
      ]],
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 80 },
        2: { cellWidth: 40 },
        3: { cellWidth: 22 },
        4: { cellWidth: 28, halign: 'right' },
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      didParseCell: (data) => {
        // Color amount column by type
        if (data.column.index === 4 && data.section === 'body') {
          const tx = filtered[data.row.index];
          if (tx) data.cell.styles.textColor = tx.type === 'income' ? [22, 163, 74] : [220, 38, 38];
        }
      },
    });

    // Category summary on new page
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text('Expenses by Category', 14, 18);

    const catMap = new Map<string, number>();
    filtered.filter(t => t.type === 'expense').forEach(t => {
      const name = t.category?.name ?? 'Unknown';
      catMap.set(name, (catMap.get(name) ?? 0) + t.amount);
    });
    const catRows = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, amt]) => [
        name,
        fmtEur(amt),
        totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(1)}%` : '0%',
      ]);

    autoTable(doc, {
      startY: 24,
      head: [['Category', 'Amount', '% of total']],
      body: catRows,
      foot: [['TOTAL', fmtEur(totalExpenses), '100%']],
      styles: { font: 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [245, 245, 245], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
      },
    });

    doc.save(`budget_${dateFrom}_${dateTo}.pdf`);
  };

  // ── Handle export ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (filtered.length === 0) return;
    setExporting(true);
    try {
      if (format === 'excel') await exportExcel();
      else await exportPdf();
    } catch (e) {
      alert('Export failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontSize: '0.72rem', fontWeight: 600,
    color: 'var(--muted-foreground)',
    letterSpacing: '0.04em', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 0.75rem',
    borderRadius: '10px', background: 'var(--muted)',
    border: '1.5px solid transparent', color: 'var(--foreground)',
    fontSize: '0.9rem', fontFamily: 'var(--font-sans)',
    outline: 'none', boxSizing: 'border-box',
    WebkitAppearance: 'none', appearance: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: `max(env(safe-area-inset-top,0px),16px) 16px max(env(safe-area-inset-bottom,0px),16px)`,
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480,
        maxHeight: '90dvh', overflowY: 'auto',
        background: 'var(--card)', borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.22)',
        WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--card)', zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Download size={16} style={{ color: 'var(--muted-foreground)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
              Export Transactions
            </h3>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--muted)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--muted-foreground)',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Format toggle */}
          <div>
            <label style={labelStyle}>Format</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                { id: 'excel' as ExportFormat, label: 'Excel', icon: <FileSpreadsheet size={15} />, color: '#16a34a' },
                { id: 'pdf'   as ExportFormat, label: 'PDF',   icon: <FileText size={15} />,        color: '#dc2626' },
              ]).map(({ id, label, icon, color }) => {
                const sel = format === id;
                return (
                  <button key={id} type="button" onClick={() => setFormat(id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    border: `1.5px solid ${sel ? color : 'transparent'}`,
                    background: sel ? `color-mix(in srgb, ${color} 10%, var(--background))` : 'var(--muted)',
                    color: sel ? color : 'var(--muted-foreground)',
                    fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    {icon} {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick presets */}
          <div>
            <label style={labelStyle}>Quick range</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {presets.map(p => (
                <button key={p.label} type="button"
                  onClick={() => { setDateFrom(toDateStr(p.from)); setDateTo(toDateStr(p.to)); }}
                  style={{
                    padding: '5px 12px', borderRadius: '999px',
                    border: '1.5px solid var(--border)',
                    background: 'var(--muted)', color: 'var(--muted-foreground)',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--muted)';
                    e.currentTarget.style.color = 'var(--muted-foreground)';
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Preview stats */}
          <div style={{
            background: 'var(--accent)', borderRadius: '12px', padding: '0.9rem 1rem',
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem',
          }}>
            {[
              { label: 'Transactions', value: String(filtered.length),   color: 'var(--foreground)' },
              { label: 'Income',       value: fmtEur(totalIncome),        color: '#16a34a' },
              { label: 'Expenses',     value: fmtEur(totalExpenses),      color: '#dc2626' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 500, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {label}
                </p>
                <p style={{ fontSize: '0.92rem', fontWeight: 700, color, margin: 0, letterSpacing: '-0.02em' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '0.82rem', margin: 0 }}>
              No transactions in this period.
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, height: 46, borderRadius: '12px',
              background: 'var(--muted)', color: 'var(--foreground)',
              border: 'none', fontSize: '0.88rem', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              WebkitTapHighlightColor: 'transparent',
            }}>
              Cancel
            </button>
            <button type="button" onClick={handleExport}
              disabled={exporting || filtered.length === 0}
              style={{
                flex: 2, height: 46, borderRadius: '12px',
                background: exporting || filtered.length === 0 ? 'var(--muted)' : 'var(--foreground)',
                color: exporting || filtered.length === 0 ? 'var(--muted-foreground)' : 'var(--background)',
                border: 'none', fontSize: '0.88rem', fontWeight: 700,
                cursor: exporting || filtered.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-sans)',
                WebkitTapHighlightColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                transition: 'all 0.15s',
              }}
            >
              {exporting
                ? <><span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Exporting…</>
                : <><Download size={15} /> Export {format === 'excel' ? 'Excel' : 'PDF'}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
