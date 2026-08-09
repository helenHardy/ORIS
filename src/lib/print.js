export function printHTML(html) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.position = 'fixed'
    frame.style.top = '0'
    frame.style.left = '-10000px'
    frame.style.width = '794px'
    frame.style.height = '1123px'
    frame.style.border = '0'
    frame.style.opacity = '0'
    frame.style.pointerEvents = 'none'
    document.body.appendChild(frame)

    const doc = frame.contentDocument || frame.contentWindow.document
    const win = frame.contentWindow

    const printAndClean = () => {
        try { win.focus() } catch { /* noop */ }
        try {
            win.print()
        } catch {
            try { window.print() } catch { /* noop */ }
        }
        setTimeout(() => {
            if (frame.parentNode) {
                frame.parentNode.removeChild(frame)
            }
        }, 1000)
    }

    doc.open()
    doc.write(html)
    doc.close()

    if (doc.readyState === 'complete') {
        printAndClean()
    } else {
        win.onload = printAndClean
    }
}

// Renders the given document HTML into a real PDF (html2canvas + jsPDF).
// The PDF is downloaded and also opened in a new tab so it can be printed
// or shared from the build-in viewer (works correctly on phones/tablets).
export async function printPDF(html, { filename = 'documento.pdf', orientation = 'portrait', format = 'a4', margin = 10 } = {}) {
    const { default: html2pdf } = await import('html2pdf.js')

    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.position = 'fixed'
    frame.style.top = '0'
    frame.style.left = '-10000px'
    frame.style.width = '794px'
    frame.style.height = '1123px'
    frame.style.border = '0'
    frame.style.opacity = '0'
    frame.style.pointerEvents = 'none'
    document.body.appendChild(frame)

    const doc = frame.contentDocument || frame.contentWindow.document

    try {
        doc.open()
        doc.write(html)
        doc.close()

        if (doc.fonts && typeof doc.fonts.ready === 'object') {
            try { await doc.fonts.ready } catch { /* fallback */ }
        }
        await new Promise(resolve => setTimeout(resolve, 350))

        const blob = await html2pdf()
            .set({
                filename: filename,
                margin,
                pagebreak: { mode: ['avoid-all'] },
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 794 },
                jsPDF: { unit: 'mm', format, orientation }
            })
            .from(doc.body)
            .output('blob')

        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
    } finally {
        if (frame.parentNode) {
            frame.parentNode.removeChild(frame)
        }
    }
}